const {Duplex} = require('stream')

const {SftpStatusError} = require('./error')
const {isInteger} = require('./util')


const PacketType = {
    SSH_FXP_INIT: 1,
   	SSH_FXP_VERSION: 2,
   	SSH_FXP_OPEN: 3,
   	SSH_FXP_CLOSE: 4,
   	SSH_FXP_READ: 5,
   	SSH_FXP_WRITE: 6,
   	SSH_FXP_LSTAT: 7,
   	SSH_FXP_FSTAT: 8,
   	SSH_FXP_SETSTAT: 9,
   	SSH_FXP_FSETSTAT: 10,
   	SSH_FXP_OPENDIR: 11,
   	SSH_FXP_READDIR: 12,
   	SSH_FXP_REMOVE: 13,
   	SSH_FXP_MKDIR: 14,
   	SSH_FXP_RMDIR: 15,
   	SSH_FXP_REALPATH: 16,
   	SSH_FXP_STAT: 17,
   	SSH_FXP_RENAME: 18,
   	SSH_FXP_READLINK: 19,
   	SSH_FXP_SYMLINK: 20,
   	SSH_FXP_STATUS: 101,
   	SSH_FXP_HANDLE: 102,
   	SSH_FXP_DATA: 103,
   	SSH_FXP_NAME: 104,
   	SSH_FXP_ATTRS: 105,
   	SSH_FXP_EXTENDED: 200,
   	SSH_FXP_EXTENDED_REPLY: 201,
}

const AttributeFlag = {
    SSH_FILEXFER_ATTR_SIZE:        0x00000001,
    SSH_FILEXFER_ATTR_UIDGID:      0x00000002,
    SSH_FILEXFER_ATTR_PERMISSIONS: 0x00000004,
    SSH_FILEXFER_ATTR_ACMODTIME:   0x00000008,
    SSH_FILEXFER_ATTR_EXTENDED:    0x80000000,
}

const OpenPurposeFlag = {
    SSH_FXF_READ:   0x00000001,
   	SSH_FXF_WRITE:  0x00000002,
   	SSH_FXF_APPEND: 0x00000004,
   	SSH_FXF_CREAT:  0x00000008,
   	SSH_FXF_TRUNC:  0x00000010,
   	SSH_FXF_EXCL:   0x00000020,
}

const StatusCode = {
    SSH_FX_OK: 0,
   	SSH_FX_EOF: 1,
   	SSH_FX_NO_SUCH_FILE: 2,
   	SSH_FX_PERMISSION_DENIED: 3,
   	SSH_FX_FAILURE: 4,
   	SSH_FX_BAD_MESSAGE: 5,
   	SSH_FX_NO_CONNECTION: 6,
   	SSH_FX_CONNECTION_LOST: 7,
   	SSH_FX_OP_UNSUPPORTED: 8,
}


class SftpPacketStream extends Duplex {
    constructor(options = {}) {
        super({
            allowHalfOpen: false
        })

        this.onwritepacket = options.writePacket || null
        this.onwritepacketv = options.writePacketv || null

        this._inputBuffer = Buffer.alloc(0)
    }

    _read(size) {
        this.resume()
    }

    _write(chunk, encoding, callback) {
        let packets = []

        const reader = new PacketBufferReader(Buffer.concat([
            this._inputBuffer,
            chunk
        ]))
        while (hasReadablePacket(reader)) {
            packets.push(readPacket(reader))
        }
        this._inputBuffer = reader.read()

        this.writePacketv(packets, callback)
    }

    _writev(chunks, callback) {
        this._write(Buffer.concat(chunks.map(entry => entry.chunk)), "buffer", callback)
    }

    _writePacket(packet, callback) {
        if (this.onwritepacket) {
            return this.onwritepacket.apply(this, [packet, callback])
        }


        if (!this.pushPacket(packet)) {
            this.pause()
        }

        callback()
    }

    _writePacketv(packets, callback) {
        if (this.onwritepacketv) {
            return this.onwritepacketv.apply(this, [packets, callback])
        }


        packets.reverse()
            .map(packet => {
                return next => this._writePacket(packet, err => {
                    if (err) {
                        return callback(err)
                    }


                    next()
                })
            })
            .reduce((nextFn, currentFn) => {
                return () => currentFn(nextFn)
            }, () => callback())
            .call()
    }

    pushPacket(packet) {

    }
}

class PacketBufferReader {
    constructor(buffer, offset = 0) {
        Object.defineProperties(this, {
            buffer: {
                value: buffer,
                configurable: false
            },
            startOffset: {
                value: startOffset,
                configurable: false
            },
            offset: {
                get() {
                    return this._offset
                },

                set(value) {
                    this._validateOffset(value)

                    this._offset = value
                }
            }
        })

        this._validateOffset(offset)
        this._offset = offset
    }

    get remainingByteLength() {
        return this.buffer.byteLength - this.offset
    }

    get finished() {
        return this.remainingByteLength <= 0
    }

    reset() {
        this.offset = this._startOffset
    }

    seek(offset) {
        this.offset = offset
    }

    peek(bytes = -1) {
        if (bytes < 0) {
            bytes = this.remainingByteLength
        }

        return this.buffer.slice(this.offset, this.offset + bytes)
    }

    read(bytes = -1) {
        const value = this.peek(bytes)
        this._offset += value.byteLength
        return value
    }

    peekUInt8() {
        return this.buffer.readUInt8(this.offset)
    }

    readUInt8() {
        const value = this.peekUInt8()
        this._offset += 1
        return value
    }

    peekUInt32() {
        return this.buffer.readUInt32BE(this.offset)
    }

    readUInt32() {
        const value = this.peekUInt32()
        this._offset += 4
        return value
    }

    peekUInt64() {
        return (this.buffer.readUInt32BE(this.offset) << 32) | this.buffer.readUInt32BE(this.offset + 4)
    }

    readUInt64() {
        const value = this.peekUInt64()
        this._offset += 8
        return value
    }

    peekString(encoding = 'utf8') {
        const length = this.peekUInt32()

        return this.buffer.toString(encoding, this.offset + 4, this.offset + 4 + length)
    }

    readString(encoding = 'utf8') {
        const value = this.peekString(encoding)
        this._offset += 4 + Buffer.byteLength(value, encoding)
        return value
    }

    canReadPacket() {
        if (this.finished) {
            return false
        }
    
    
        if (this.remainingByteLength < 5) {
            return false
        }
    
    
        const packetPayloadSize = this.peekUInt32()
        if (this.remainingByteLength < 5 + packetPayloadSize) {
            return false
        }
    
        return true
    }

    readPacket() {
        if (!this.canReadPacket()) {
            throw new SftpStatusError(StatusCode.SSH_FX_BAD_MESSAGE)
        }


        const packetReadStartOffset = this.offset
        
        const payloadLength = this.readUInt32()

        const packet = {}
        packet.type = this.readUInt8()
        packet.payload = {}
        switch (type) {
            case PacketType.SSH_FXP_INIT:  {
                payload.version = parser.readUInt32()
                payload.extensions = {}
                while (!parser.isFinished()) { // TODO:  Don't be lazy
                    const extensionName = parser.readString()
                    const extensionData = parser.readString()

                    payload.extensions[extensionName] = extensionData
                }
                break

            case PacketType.SSH_FXP_VERSION: {
                payload.version = parser.readUInt32()
                payload.extensions = {}
                while (!parser.isFinished()) {
                    const extensionName = parser.readString()
                    const extensionData = parser.readString()

                    payload.extensions[extensionName] = extensionData
                }
                break

            case PacketType.SSH_FXP_OPEN: {
                payload.id = parser.readUInt32()
                payload.filename = parser.readString()
                payload.pflags = parser.readUInt32()
                payload.attrs = readAttributes(parser)
                break

            case PacketType.SSH_FXP_CLOSE: {
                payload.id = parser.readUInt32()
                payload.handle = parser.readString()
                break

            case PacketType.SSH_FXP_READ: {
                payload.id = parser.readUInt32()
                payload.handle = parser.readString()
                payload.offset = parser.readUInt64()
                payload.len = parser.readUInt32()
                break

            case PacketType.SSH_FXP_WRITE: {
                payload.id = parser.readUInt32()
                payload.handle = parser.readString()
                payload.offset = parser.readUInt64()
                payload.data = parser.readString()
                break

            case PacketType.SSH_FXP_LSTAT: {
                payload.id = parser.readUInt32()
                payload.path = parser.readString()
                break

            case PacketType.SSH_FXP_FSTAT: {
                payload.id = parser.readUInt32()
                payload.handle = parser.readString()
                break

            case PacketType.SSH_FXP_SETSTAT: {
                payload.id = parser.readUInt32()
                payload.path = parser.readString()
                payload.attrs = readAttributes(parser)
                break

            case PacketType.SSH_FXP_FSETSTAT: {
                payload.id = parser.readUInt32()
                payload.handle = parser.readString()
                payload.attrs = readAttributes(parser)
                break

            case PacketType.SSH_FXP_OPENDIR: {
                payload.id = parser.readUInt32()
                payload.path = parser.readString()
                break

            case PacketType.SSH_FXP_READDIR: {
                payload.id = parser.readUInt32()
                payload.handle = parser.readString()
                break

            case PacketType.SSH_FXP_REMOVE: {
                payload.id = parser.readUInt32()
                payload.filename = parser.readString()
                break

            case PacketType.SSH_FXP_MKDIR: {
                payload.id = parser.readUInt32()
                payload.path = parser.readString()
                payload.attrs = this.readAttributes()
                break

            case PacketType.SSH_FXP_RMDIR: {
                payload.id = parser.readUInt32()
                payload.path = parser.readString()
                break

            case PacketType.SSH_FXP_REALPATH: {
                payload.id = parser.readUInt32()
                payload.path = parser.readString()
                break

            case PacketType.SSH_FXP_STAT: {
                payload.id = parser.readUInt32()
                payload.path = parser.readString()
                break

            case PacketType.SSH_FXP_RENAME: {
                payload.id = parser.readUInt32()
                payload.oldpath = parser.readString()
                payload.newpath = parser.readString()
                break

            case PacketType.SSH_FXP_READLINK: {
                payload.id = parser.readUInt32()
                payload.path = parser.readString()
                break

            case PacketType.SSH_FXP_SYMLINK: {
                payload.id = parser.readUInt32()
                payload.linkpath = parser.readString()
                payload.targetpath = parser.readString()
                break

            case PacketType.SSH_FXP_STATUS:
                payload.id = parser.readUInt32()
                payload.code = parser.readUInt32()
                payload.message = parser.readString()
                payload.language = parser.readString()
                break

            case PacketType.SSH_FXP_HANDLE:
                payload.id = parser.readUInt32()
                payload.handle = parser.readString()
                break

            case PacketType.SSH_FXP_DATA:
                payload.id = parser.readUInt32()
                payload.data = parser.readString()
                break

            case PacketType.SSH_FXP_NAME: 
                payload.id = parser.readUInt32()

                payload.names = []
                const nameCount = parser.readUInt32()
                for (let i = 0;i < nameCount;++i) {
                    const name = {}
                    name.filename = parser.readString()
                    name.longname = parser.readString()
                    name.attrs = this.readAttributes()
                    payload.names = []
                }
                break

            case PacketType.SSH_FXP_ATTRS:
                payload.id = parser.readUInt32()
                payload.attrs = readAttributes(parser)
                break

            case PacketType.SSH_FXP_EXTENDED:
                payload.id = parser.readUInt32()
                payload.extendedRequest = parser.readString()
                payload.requestData = parser.read()
                break

            case PacketType.SSH_FXP_EXTENDED_REPLY:
                payload.id = parser.readUInt32()
                payload.replyData = parser.read()
                break

            default:
                throw new SftpStatusError(StatusCode.SSH_FX_OP_UNSUPPORTED)
        }
    }

    _validateOffset(offset) {
        if (!isInteger(offset)) {
            throw new RuntimeError("Offset must be a valid integer.")
        }

        if (offset < 0 || offset > this.buffer.byteLength) {
            throw new RuntimeError("Offset out of range.")
        }
    }
}

function hasReadablePacket(reader) {
    
}

function readPacket(reader)  {
    const parser = new PacketParser(buffer, offset)

    const packetPayloadLength = parser.readUInt32()
    
    const packet = {}
    packet.type = parser.readUInt8()

    const payloadParser = new PacketParser(parser.read(packetPayloadLength))
    packet.payload = readPacketPayload(packet.type, payloadParser)
    if (!payloadParser.isFinished()) {
        throw new RuntimeError("Entire packet payload was not read from buffer.  An error has likely occured.")
    }

    return packet
}

function readPacketPayload(type, parser) {
}

function readAttributes(parser) {
    const attr = {}
    attr.flags = parser.readUInt32()
    
    if (attr.flags & AttributeFlag.SSH_FILEXFER_ATTR_SIZE) {
        attr.size = parser.readUInt64()
    }

    if (attr.flags & AttributeFlag.SSH_FILEXFER_ATTR_UIDGID) {
        attr.uid = parser.readUInt32()
        attr.gid = parser.readUInt32()
    }

    if (attr.flags & AttributeFlag.SSH_FILEXFER_ATTR_PERMISSIONS) {
        attr.permissions = parser.readUInt32()
    }

    if (attr.flags & AttributeFlag.SSH_FILEXFER_ATTR_ACMODTIME) {
        attr.atime = parser.readUInt32()
        attr.mtime = parser.readUInt32()
    }

    if (attr.flags & AttributeFlag.SSH_FILEXFER_ATTR_EXTENDED) {
        const extendedCount = parser.readUInt32()

        attr.extended = {}
        for (let i = 0;i < extendedCount;++i) {
            const extendedType = parser.readString()
            const extendedData = parser.readString()

            attr.extended[extendedType] = extendedData
        }
    }

    return attr
}

function encodePacket(packet) {
    const packetPayloadBuffer = encodePacketPayload(packet.type, packet.payload)

    const packetBuffer = Buffer.alloc(4 + 1 + packetPayloadBuffer.byteLength)


    let offset = 0
    
    packetBuffer.writeUInt32BE(packetPayloadBuffer.byteLength, offset)
    offset += 4

    packetBuffer.writeUInt8(packet.type, offset)
    offset += 1

    packetPayloadBuffer.copy(packetBuffer, offset)
    offset += packetBuffer.byteLength

    return packetBuffer
}

function encodePacketPayload(type, payload) {
    switch (type) {
        /*case PacketType.SSH_FXP_INIT:
        case PacketType.SSH_FXP_VERSION:
        case PacketType.SSH_FXP_OPEN:
        case PacketType.SSH_FXP_CLOSE:
        case PacketType.SSH_FXP_READ:
        case PacketType.SSH_FXP_WRITE:
        case PacketType.SSH_FXP_LSTAT:
        case PacketType.SSH_FXP_FSTAT:
        case PacketType.SSH_FXP_SETSTAT:
        case PacketType.SSH_FXP_FSETSTAT:
        case PacketType.SSH_FXP_OPENDIR:
        case PacketType.SSH_FXP_READDIR:
        case PacketType.SSH_FXP_REMOVE:
        case PacketType.SSH_FXP_MKDIR:
        case PacketType.SSH_FXP_RMDIR:
        case PacketType.SSH_FXP_REALPATH:
        case PacketType.SSH_FXP_STAT:
        case PacketType.SSH_FXP_RENAME:
        case PacketType.SSH_FXP_READLINK:
        case PacketType.SSH_FXP_SYMLINK:*/

        case PacketType.SSH_FXP_STATUS: {
            const {
                id,
                code,
                message,
                language = ""
            } = payload

            const buffer = Buffer.alloc(4 + 4 + 4 + message.length + 4 + language.length)

            
            let offset =  0;

            buffer.writeUInt32BE(id, offset)
            offset += 4

            buffer.writeUInt32BE(code, offset)
            offset += 4

            buffer.writeUInt32BE(message.length, offset)
            offset += 4

            buffer.write(message, offset)
            offset += message.length

            buffer.writeUInt32BE(language.length, offset)
            offset += 4

            buffer.write(language, offset)
            offset += language.length

            return buffer;
        }

        /*case PacketType.SSH_FXP_HANDLE:
        case PacketType.SSH_FXP_DATA:
        case PacketType.SSH_FXP_NAME:
        case PacketType.SSH_FXP_ATTRS:
        case PacketType.SSH_FXP_EXTENDED:
        case PacketType.SSH_FXP_EXTENDED_REPLY:*/

        default: 
            throw new RuntimeError(`Unimplemented or Unknown Packet Type (${type})`)
    }
}


module.exports = {
    PacketType,
    AttributeFlag,
    OpenPurposeFlag,
    StatusCode,
    PacketParser,
    readPacket,
    encodePacket
}
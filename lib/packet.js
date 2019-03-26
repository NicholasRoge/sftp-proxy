const {PACKET_MAX_SIZE, PacketType, AttributeFlag, OpenPurposeFlag, StatusCode} = require('./constants.js')
const {SftpStatusError} = require('./error')
const {isInteger} = require('./util')


class PacketDecoder {
    constructor(buffer, offset = 0) {
        Object.defineProperties(this, {
            buffer: {
                value: buffer,
                configurable: false
            },
            startOffset: {
                value: offset,
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
    
    
        const packetDataSize = this.peekUInt32()
        if (this.remainingByteLength < 4 + packetDataSize) {
            return false
        }
    
        return true
    }

    readPacket() {
        if (!this.canReadPacket()) {
            throw new SftpStatusError(StatusCode.SSH_FX_BAD_MESSAGE)
        }


        
        const dataLength = this.readUInt32()

        const packet = {}
        packet.type = this.readUInt8()
        packet.payload = this.readPacketPayload(packet.type, dataLength - 1)

        return packet
    }

    readPacketPayload(type, payloadLength) {
        const payload = {}
        const payloadEndOffset = this.offset + payloadLength

        switch (type) {
            case PacketType.SSH_FXP_INIT:
                payload.version = this.readUInt32()
                payload.extensions = {}
                while (this.offset < payloadEndOffset) { 
                    const extensionName = this.readString()
                    const extensionData = this.readString()

                    payload.extensions[extensionName] = extensionData
                }
                break

            case PacketType.SSH_FXP_VERSION: 
                payload.version = this.readUInt32()
                payload.extensions = {}
                while (this.offset < payloadEndOffset) {
                    const extensionName = this.readString()
                    const extensionData = this.readString()

                    payload.extensions[extensionName] = extensionData
                }
                break

            case PacketType.SSH_FXP_OPEN:
                payload.id = this.readUInt32()
                payload.filename = this.readString()
                payload.pflags = this.readUInt32()
                payload.attrs = this.readAttributes()
                break

            case PacketType.SSH_FXP_CLOSE:
                payload.id = this.readUInt32()
                payload.handle = this.readString()
                break

            case PacketType.SSH_FXP_READ:
                payload.id = this.readUInt32()
                payload.handle = this.readString()
                payload.offset = this.readUInt64()
                payload.len = this.readUInt32()
                break

            case PacketType.SSH_FXP_WRITE:
                payload.id = this.readUInt32()
                payload.handle = this.readString()
                payload.offset = this.readUInt64()
                payload.data = this.readString()
                break

            case PacketType.SSH_FXP_LSTAT:
                payload.id = this.readUInt32()
                payload.path = this.readString()
                break

            case PacketType.SSH_FXP_FSTAT:
                payload.id = this.readUInt32()
                payload.handle = this.readString()
                break

            case PacketType.SSH_FXP_SETSTAT:
                payload.id = this.readUInt32()
                payload.path = this.readString()
                payload.attrs = this.readAttributes()
                break

            case PacketType.SSH_FXP_FSETSTAT:
                payload.id = this.readUInt32()
                payload.handle = this.readString()
                payload.attrs = this.readAttributes()
                break

            case PacketType.SSH_FXP_OPENDIR:
                payload.id = this.readUInt32()
                payload.path = this.readString()
                break

            case PacketType.SSH_FXP_READDIR:
                payload.id = this.readUInt32()
                payload.handle = this.readString()
                break

            case PacketType.SSH_FXP_REMOVE:
                payload.id = this.readUInt32()
                payload.filename = this.readString()
                break

            case PacketType.SSH_FXP_MKDIR:
                payload.id = this.readUInt32()
                payload.path = this.readString()
                payload.attrs = this.readAttributes()
                break

            case PacketType.SSH_FXP_RMDIR:
                payload.id = this.readUInt32()
                payload.path = this.readString()
                break

            case PacketType.SSH_FXP_REALPATH:
                payload.id = this.readUInt32()
                payload.path = this.readString()
                break

            case PacketType.SSH_FXP_STAT:
                payload.id = this.readUInt32()
                payload.path = this.readString()
                break

            case PacketType.SSH_FXP_RENAME:
                payload.id = this.readUInt32()
                payload.oldpath = this.readString()
                payload.newpath = this.readString()
                break

            case PacketType.SSH_FXP_READLINK:
                payload.id = this.readUInt32()
                payload.path = this.readString()
                break

            case PacketType.SSH_FXP_SYMLINK:
                payload.id = this.readUInt32()
                payload.linkpath = this.readString()
                payload.targetpath = this.readString()
                break

            case PacketType.SSH_FXP_STATUS:
                payload.id = this.readUInt32()
                payload.code = this.readUInt32()
                payload.message = this.readString()
                payload.language = this.readString()
                break

            case PacketType.SSH_FXP_HANDLE:
                payload.id = this.readUInt32()
                payload.handle = this.readString()
                break

            case PacketType.SSH_FXP_DATA:
                payload.id = this.readUInt32()
                payload.data = this.readString()
                break

            case PacketType.SSH_FXP_NAME: 
                payload.id = this.readUInt32()

                payload.names = []
                const nameCount = this.readUInt32()
                for (let i = 0;i < nameCount;++i) {
                    const name = {}
                    name.filename = this.readString()
                    name.longname = this.readString()
                    name.attrs = this.readAttributes()
                    payload.names.push(name)
                }
                break

            case PacketType.SSH_FXP_ATTRS:
                payload.id = this.readUInt32()
                payload.attrs = this.readAttributes()
                break

            case PacketType.SSH_FXP_EXTENDED:
                payload.id = this.readUInt32()
                payload.extendedRequest = this.readString()
                payload.requestData = this.read()
                break

            case PacketType.SSH_FXP_EXTENDED_REPLY:
                payload.id = this.readUInt32()
                payload.replyData = this.read()
                break

            default:
                throw new SftpStatusError(StatusCode.SSH_FX_OP_UNSUPPORTED)
        }


        if (this.offset < payloadEndOffset) {
            throw new Error("Entire packet payload was not read from buffer.  An error has likely occured.")
        } else if (this.offset > payloadEndOffset) {
            throw new Error("Packet payload size larger than expected.  An error has likely occured.")
        }


        return payload
    }

    readAttributes() {
        const attr = {}
        attr.flags = this.readUInt32()
        
        if (attr.flags & AttributeFlag.SSH_FILEXFER_ATTR_SIZE) {
            attr.size = this.readUInt64()
        }

        if (attr.flags & AttributeFlag.SSH_FILEXFER_ATTR_UIDGID) {
            attr.uid = this.readUInt32()
            attr.gid = this.readUInt32()
        }

        if (attr.flags & AttributeFlag.SSH_FILEXFER_ATTR_PERMISSIONS) {
            attr.permissions = this.readUInt32()
        }

        if (attr.flags & AttributeFlag.SSH_FILEXFER_ATTR_ACMODTIME) {
            attr.atime = this.readUInt32()
            attr.mtime = this.readUInt32()
        }

        if (attr.flags & AttributeFlag.SSH_FILEXFER_ATTR_EXTENDED) {
            const extendedCount = this.readUInt32()

            attr.extended = {}
            for (let i = 0;i < extendedCount;++i) {
                const extendedType = this.readString()
                const extendedData = this.readString()

                attr.extended[extendedType] = extendedData
            }
        }

        return attr
    }

    _validateOffset(offset) {
        if (!isInteger(offset)) {
            throw new Error("Offset must be a valid integer.")
        }

        if (offset < 0 || offset > this.buffer.byteLength) {
            throw new Error("Offset out of range.")
        }
    }
}

class PacketEncoder {
    constructor(buffer, offset = 0) {
        Object.defineProperties(this, {
            buffer: {
                value: buffer,
                configurable: false
            },
            startOffset: {
                value: offset,
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

    write(buffer, startOffset = 0, endOffset = -1) {
        endOffset = Math.min(buffer.byteLength, endOffset < 0 ? buffer.byteLength : endOffset)
        if (endOffset - startOffset > this.remainingByteLength) {
            throw new RuntimeException("Source buffer is too large.")
        }


        const bytesWritten = buffer.copy(this.buffer, this.offset, startOffset, endOffset)
        this._offset += bytesWritten
        return bytesWritten
    }

    writeUInt8(value) {
        this._offset = this.buffer.writeUInt8(value, this._offset)
    }

    writeUInt32(value) {
        this._offset = this.buffer.writeUInt32BE(value, this._offset)
    }

    writeUInt64(value) {
        this._offset = this.buffer.writeUInt32BE((value >> 32) & 0xFFFFFFFF, this._offset)
        this._offset = this.buffer.writeUInt32BE(value & 0xFFFFFFFF, this._offset)
    }

    writeString(value, encoding = 'utf8') {
        const valueLength = Buffer.byteLength(value, encoding)

        this.writeUInt32(valueLength)
        this._offset += this.buffer.write(value, this._offset, valueLength, encoding)
    }

    writePacket(packet) {
        const packetStartOffset = this.offset

        this.writeUInt32(0)

        const dataStartOffset = this.offset
        this.writeUInt8(packet.type)
        this.writePacketPayload(packet.type, packet.payload)
        const dataEndOffset = this.offset

        this.seek(packetStartOffset)
        this.writeUInt32(dataEndOffset - dataStartOffset)
        this.seek(dataEndOffset)
    }

    writePacketPayload(type, payload) {
        switch (type) {
            case PacketType.SSH_FXP_INIT:
                this.writeUInt32(payload.version)
                for (const extensionName in payload.extensions) {
                    this.writeString(extensionName)
                    this.writeString(payload.extensions[extensionName])
                }
                break

            case PacketType.SSH_FXP_VERSION: 
                this.writeUInt32(payload.version)
                for (const extensionName in payload.extensions) {
                    this.writeString(extensionName)
                    this.writeString(payload.extensions[extensionName])
                }
                break

            case PacketType.SSH_FXP_OPEN:
                this.writeUInt32(payload.id)
                this.writeString(payload.filename)
                this.writeUInt32(payload.pflags)
                this.writeAttributes(payload.attrs)
                break

            case PacketType.SSH_FXP_CLOSE:
                this.writeUInt32(payload.id)
                this.writeString(payload.handle)
                break

            case PacketType.SSH_FXP_READ:
                this.writeUInt32(payload.id)
                this.writeString(payload.handle)
                this.writeUInt64(payload.offset)
                this.writeUInt32(payload.len)
                break

            case PacketType.SSH_FXP_WRITE:
                this.writeUInt32(payload.id)
                this.writeString(payload.handle)
                this.writeUInt64(payload.offset)
                this.writeString(payload.data)
                break

            case PacketType.SSH_FXP_LSTAT:
                this.writeUInt32(payload.id)
                this.writeString(payload.path)
                break

            case PacketType.SSH_FXP_FSTAT:
                this.writeUInt32(payload.id)
                this.writeString(payload.handle)
                break

            case PacketType.SSH_FXP_SETSTAT:
                this.writeUInt32(payload.id)
                this.writeString(payload.path)
                this.writeAttributes(payload.attrs)
                break

            case PacketType.SSH_FXP_FSETSTAT:
                this.writeUInt32(payload.id)
                this.writeString(payload.handle)
                this.writeAttributes(payload.attrs)
                break

            case PacketType.SSH_FXP_OPENDIR:
                this.writeUInt32(payload.id)
                this.writeString(payload.path)
                break

            case PacketType.SSH_FXP_READDIR:
                this.writeUInt32(payload.id)
                this.writeString(payload.handle)
                break

            case PacketType.SSH_FXP_REMOVE:
                this.writeUInt32(payload.id)
                this.writeString(payload.filename)
                break

            case PacketType.SSH_FXP_MKDIR:
                this.writeUInt32(payload.id)
                this.writeString(payload.path)
                this.writeAttributes(payload.attrs)
                break

            case PacketType.SSH_FXP_RMDIR:
                this.writeUInt32(payload.id)
                this.writeString(payload.path)
                break

            case PacketType.SSH_FXP_REALPATH:
                this.writeUInt32(payload.id)
                this.writeString(payload.path)
                break

            case PacketType.SSH_FXP_STAT:
                this.writeUInt32(payload.id)
                this.writeString(payload.path)
                break

            case PacketType.SSH_FXP_RENAME:
                this.writeUInt32(payload.id)
                this.writeString(payload.oldpath)
                this.writeString(payload.newpath)
                break

            case PacketType.SSH_FXP_READLINK:
                this.writeUInt32(payload.id)
                this.writeString(payload.path)
                break

            case PacketType.SSH_FXP_SYMLINK:
                this.writeUInt32(payload.id)
                this.writeString(payload.linkpath)
                this.writeString(payload.targetpath)
                break

            case PacketType.SSH_FXP_STATUS:
                this.writeUInt32(payload.id)
                this.writeUInt32(payload.code)
                this.writeString(payload.message)
                this.writeString(payload.language)
                break

            case PacketType.SSH_FXP_HANDLE:
                this.writeUInt32(payload.id)
                this.writeString(payload.handle)
                break

            case PacketType.SSH_FXP_DATA:
                this.writeUInt32(payload.id)
                this.writeString(payload.data)
                break

            case PacketType.SSH_FXP_NAME: 
                this.writeUInt32(payload.id)
                this.writeUInt32(payload.names.length)
                payload.names.forEach(name => {
                    this.writeString(name.filename)
                    this.writeString(name.longname)
                    this.writeAttributes(name.attrs)
                })
                break

            case PacketType.SSH_FXP_ATTRS:
                this.writeUInt32(payload.id)
                this.writeAttributes(payload.attrs)
                break

            case PacketType.SSH_FXP_EXTENDED:
                this.writeUInt32(payload.id)
                this.writeString(payload.extendedRequest)
                this.write(payload.requestData)
                break

            case PacketType.SSH_FXP_EXTENDED_REPLY:
                this.writeUInt32(payload.id)
                this.write(payload.replyData)
                break

            default:
                throw new SftpStatusError(StatusCode.SSH_FX_OP_UNSUPPORTED)
        }
    }

    writeAttributes(attr) {
        this.writeUInt32(attr.flags)
        
        if (attr.flags & AttributeFlag.SSH_FILEXFER_ATTR_SIZE) {
            this.writeUInt64(attr.size)
        }

        if (attr.flags & AttributeFlag.SSH_FILEXFER_ATTR_UIDGID) {
            this.writeUInt32(attr.uid)
            this.writeUInt32(attr.gid)
        }

        if (attr.flags & AttributeFlag.SSH_FILEXFER_ATTR_PERMISSIONS) {
            this.writeUInt32(attr.permissions)
        }

        if (attr.flags & AttributeFlag.SSH_FILEXFER_ATTR_ACMODTIME) {
            this.writeUInt32(attr.atime)
            this.writeUInt32(attr.mtime)
        }

        if (attr.flags & AttributeFlag.SSH_FILEXFER_ATTR_EXTENDED) {
            this.writeUInt32(Object.keys(attr.extended).length)
            Object.entries(attr.extended).forEach((extendedType, extendedData) => {
                if (Buffer.isBuffer(extendedData)) {
                    extendedData = extendedData.toString('utf8')
                }

                this.writeString(extendedType)
                this.writeString(extendedData)
            })
        }
    }

    _validateOffset(offset) {
        if (!isInteger(offset)) {
            throw new Error("Offset must be a valid integer.")
        }

        if (offset < 0 || offset > this.buffer.byteLength) {
            throw new Error("Offset out of range.")
        }
    }
}

function decodePacket(buffer, offset) {
    const reader = new PacketDecoder(buffer, offset)
    return reader.readPacket()
}

const encodePacketBuffer = Buffer.alloc(PACKET_MAX_SIZE)  // Rather than allocate a new buffer every time encodePacket is called, just reuse this one
function encodePacket(packet) {
    const encoder = new PacketEncoder(encodePacketBuffer)
    encoder.writePacket(packet)

    return encodePacketBuffer.slice(0, encoder.offset)
}


module.exports = {
    PacketDecoder,
    PacketEncoder,
    decodePacket,
    encodePacket
}
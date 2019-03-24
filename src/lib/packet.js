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


class PacketParser {
    constructor(buffer, offset = 0) {
        this._buffer = buffer
        
        this._startOffset = offset
        this._offset = offset
    }

    reset() {
        this._offset = this._startOffset
    }

    seek(offset) {
        this._offset = offset
    }

    read(bytes = -1) {
        if (bytes < 0) {
            bytes = this._buffer.length - this._offset
        }

        const value = this._buffer.slice(this._offset, this._offset + bytes)
        this._offset += value.byteLength
        return value
    }

    readUInt8() {
        const value = this._buffer.readUInt8(this._offset)
        this._offset += 1
        return value
    }

    readUInt32() {
        const value = this._buffer.readUInt32BE(this._offset)
        this._offset += 4
        return value
    }

    readUInt64() {
        const value = (this._buffer.readUInt32BE(this._offset) << 32) | this._buffer.readUInt32BE(this._offset + 4)
        this._offset += 8
        return value
    }

    readString(encoding = 'UTF-8') {
        const valueLength = this.readUInt32()

        const value = this._buffer.toString(encoding, this._offset, this._offset + valueLength)
        this._offset += valueLength
        return value
    }

    isFinished() {
        return this._offset >= this._buffer.byteLength
    }
}

function readPacket(buffer, offset = 0)  {
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
    switch (type) {
        case PacketType.SSH_FXP_INIT:  {
            const payload = {}

            payload.version = parser.readUInt32()

            payload.extensions = {}
            while (!parser.isFinished()) { // TODO:  Don't be lazy
                const extensionName = parser.readString()
                const extensionData = parser.readString()

                payload.extensions[extensionName] = extensionData
            }

            return payload
        }

        case PacketType.SSH_FXP_VERSION: {
            const payload = {}

            payload.version = parser.readUInt32()

            payload.extensions = {}
            while (!parser.isFinished()) {
                const extensionName = parser.readString()
                const extensionData = parser.readString()

                payload.extensions[extensionName] = extensionData
            }

            return payload
        }

        case PacketType.SSH_FXP_OPEN: {
            const payload = {}

            payload.id = parser.readUInt32()
            payload.filename = parser.readString()
            payload.pflags = parser.readUInt32()
            payload.attrs = readAttributes(parser)

            return payload
        }

        case PacketType.SSH_FXP_CLOSE: {
            const payload = {}

            payload.id = parser.readUInt32()
            payload.handle = parser.readString()

            return payload
        }

        case PacketType.SSH_FXP_READ: {
            const payload = {}

            payload.id = parser.readUInt32()
            payload.handle = parser.readString()
            payload.offset = parser.readUInt64()
            payload.len = parser.readUInt32()

            return payload
        }

        case PacketType.SSH_FXP_WRITE: {
            const payload = {}

            payload.id = parser.readUInt32()
            payload.handle = parser.readString()
            payload.offset = parser.readUInt64()
            payload.data = parser.readString()

            return payload
        }

        case PacketType.SSH_FXP_LSTAT: {
            const payload = {}

            payload.id = parser.readUInt32()
            payload.path = parser.readString()

            return payload
        }

        case PacketType.SSH_FXP_FSTAT: {
            const payload = {}

            payload.id = parser.readUInt32()
            payload.handle = parser.readString()

            return payload
        }

        case PacketType.SSH_FXP_SETSTAT: {
            const payload = {}

            payload.id = parser.readUInt32()
            payload.path = parser.readString()
            payload.attrs = readAttributes(parser)

            return payload
        }

        case PacketType.SSH_FXP_FSETSTAT: {
            const payload = {}

            payload.id = parser.readUInt32()
            payload.handle = parser.readString()
            payload.attrs = readAttributes(parser)

            return payload
        }

        case PacketType.SSH_FXP_OPENDIR: {
            const payload = {}

            payload.id = parser.readUInt32()
            payload.path = parser.readString()

            return payload
        }

        case PacketType.SSH_FXP_READDIR: {
            const payload = {}

            payload.id = parser.readUInt32()
            payload.handle = parser.readString()

            return payload
        }

        case PacketType.SSH_FXP_REMOVE: {
            const payload = {}

            payload.id = parser.readUInt32()
            payload.filename = parser.readString()

            return payload
        }

        case PacketType.SSH_FXP_MKDIR: {
            const payload = {}

            payload.id = parser.readUInt32()
            payload.path = parser.readString()
            payload.attrs = readAttributes(parser)

            return payload
        }

        case PacketType.SSH_FXP_RMDIR: {
            const payload = {}

            payload.id = parser.readUInt32()
            payload.path = parser.readString()

            return payload
        }

        case PacketType.SSH_FXP_REALPATH: {
            const payload = {}

            payload.id = parser.readUInt32()
            payload.path = parser.readString()

            return payload
        }

        case PacketType.SSH_FXP_STAT: {
            const payload = {}

            payload.id = parser.readUInt32()
            payload.path = parser.readString()

            return payload
        }

        case PacketType.SSH_FXP_RENAME: {
            const payload = {}

            payload.id = parser.readUInt32()
            payload.oldpath = parser.readString()
            payload.newpath = parser.readString()

            return payload
        }

        case PacketType.SSH_FXP_READLINK: {
            const payload = {}

            payload.id = parser.readUInt32()
            payload.path = parser.readString()

            return payload
        }

        case PacketType.SSH_FXP_SYMLINK: {
            const payload = {}

            payload.id = parser.readUInt32()
            payload.linkpath = parser.readString()
            payload.targetpath = parser.readString()

            return payload
        }

        case PacketType.SSH_FXP_STATUS: {
            const payload = {}

            payload.id = parser.readUInt32()
            payload.code = parser.readUInt32()
            payload.message = parser.readString()
            payload.language = parser.readString()

            return payload
        }

        case PacketType.SSH_FXP_HANDLE: {
            const payload = {}

            payload.id = parser.readUInt32()
            payload.handle = parser.readString()

            return payload
        }

        case PacketType.SSH_FXP_DATA: {
            const payload = {}

            payload.id = parser.readUInt32()
            payload.data = parser.readString()

            return payload
        }

        case PacketType.SSH_FXP_NAME: {
            const payload = {}

            payload.id = parser.readUInt32()

            const nameCount = parser.readUInt32()
            payload.names = []
            for (let i = 0;i < nameCount;++i) {
                const name = {}
                name.filename = parser.readString()
                name.longname = parser.readString()
                name.attrs = readAttributes(parser)
                payload.names = []
            }

            return payload
        }

        case PacketType.SSH_FXP_ATTRS: {
            const payload = {}

            payload.id = parser.readUInt32()
            payload.attrs = readAttributes(parser)

            return payload
        }

        case PacketType.SSH_FXP_EXTENDED: {
            const payload = {}

            payload.id = parser.readUInt32()
            payload.extendedRequest = parser.readString()
            payload.requestData = parser.read()

            return payload
        }

        case PacketType.SSH_FXP_EXTENDED_REPLY: {
            const payload = {}

            payload.id = parser.readUInt32()
            payload.replyData = parser.read()

            return payload
        }

        default:
            return buffer
    }
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
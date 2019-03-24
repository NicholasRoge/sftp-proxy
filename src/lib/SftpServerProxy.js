const {spawn} = require('child_process')
const fs = require('fs')
const {Duplex} = require('stream')
const {ReadableStreamBuffer} = require('stream-buffers')
const {readPacket, encodePacket, PacketType} = require('./packet')


class SftpServerProxy extends Duplex {
    constructor() {
        super()

        this._outputBuffer = new ReadableStreamBuffer({
            chunkSize: this.readableHighWaterMark
        })
        this._outputBuffer.on('data', chunk => {
            const currentPacket = readPacket(chunk)
            if (currentPacket.type !== PacketType.SSH_FXP_INIT && currentPacket.type !== PacketType.SSH_FXP_VERSION) {
                this._requestById[currentPacket.payload.id].response = currentPacket
            }

            if (!this.push(chunk)) {
                this._outputBuffer.pause()
            }
        })
        this._outputBuffer.pause()

        this.sftpProcess = spawn('/usr/libexec/sftp-server', ['-d', process.env.HOME])
        this.sftpProcess.stdout.on('data', chunk => {
            this._outputBuffer.put(chunk)
        })

        this._requestById = {}
        this._requests = []
    }

    _read(size)  {
        this._outputBuffer.resume()
    }

    _write(chunk, encoding, callback) {
        const currentPacket = readPacket(chunk)
        
        if (currentPacket.type !== PacketType.SSH_FXP_INIT && currentPacket.type !== PacketType.SSH_FXP_VERSION) {
            const request = {
                id: currentPacket.payload.id,
                request: currentPacket,
                response: null
            }
            this._requests.push(request)
            this._requestById[request.id] = request
        }

        if (false && currentPacket.type === PacketType.SSH_FXP_OPEN) {
            const packet = encodePacket({
                type: PacketType.SSH_FXP_STATUS,
                payload: {
                    id: chunk.readUInt32BE(5),
                    code: 3,
                    message: "Permission denied"
                }
            })
            this._outputBuffer.put(packet)

            callback()
        } else {
            this.sftpProcess.stdin.write(chunk, encoding, callback)
        }
    }

    _final(callback) {
        this.sftpProcess.stdin.end()
        this._outputBuffer.stop()

        fs.writeFileSync("conversation.json", JSON.stringify(this._requests, null, 2))

        callback()
    }
}


module.exports = SftpServerProxy
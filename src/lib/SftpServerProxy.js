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
                this._transactionById[currentPacket.payload.id].response = currentPacket
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

        this._transactionById = {}
        this._transactions = []
    }

    _read(size)  {
        this._outputBuffer.resume()
    }

    _write(chunk, encoding, callback) {
        const request = readPacket(chunk)
        const response = this._processRequest(chunk)
        if (response) {
            this._outputBuffer.put(encodePacket(response))

            callback()
        } else {
            this.sftpProcess.stdin.write(chunk, encoding, callback)
        }
    }

    _final(callback) {
        this.sftpProcess.stdin.end()
        this._outputBuffer.stop()

        fs.writeFileSync("conversation.json", JSON.stringify(this._transactions, null, 2))

        callback()
    }

    _processRequest(request) {
        if (request.type !== PacketType.SSH_FXP_INIT) {
            const transaction = {
                id: request.payload.id,
                request: request,
                response: null
            }
            this._transactions.push(transaction)
            this._transactionById[request.id] = transaction
        }

        if (request.type === PacketType.SSH_FXP_OPEN) {
            const response = encodePacket({
                type: PacketType.SSH_FXP_STATUS,
                payload: {
                    id: chunk.readUInt32BE(5),
                    code: 3,
                    message: "Permission denied"
                }
            })
            this._outputBuffer.put(packet)

            callback()
        }
    }

    _processResponse(packet) {
    }
}


module.exports = SftpServerProxy
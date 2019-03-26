const {PacketType, StatusCode, DefaultErrorMessage} = require('./constants')


class SftpStatusError extends Error {
    constructor(id, messageOrCode = StatusCode.SSH_FX_FAILURE, message = null, language = "") {
        const code = typeof messageOrCode  === "string" ? StatusCode.SSH_FX_FAILURE : messageOrCode
        message = message || DefaultErrorMessage[code] || "An error has occured"

        super(message)

        Object.defineProperties(this, {
            id: {
                value: id,
                configurable: false
            },
            code: {
                value: code,
                configurable: false
            },
            language: {
                value: language,
                configurable: false
            }
        })
    }

    toStatusPacket() {
        return {
            type: PacketType.SSH_FXP_STATUS,
            payload: {
                id: this.id,
                code: this.code,
                message: this.message,
                language: this.language
            }
        }
    }
}


module.exports = {
    SftpStatusError
}
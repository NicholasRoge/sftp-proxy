const {PacketType, StatusCode} = require('./packet')


const DefaultErrorMessage = {
    [StatusCode.SSH_FX_OK]: "Success", // AKA, your request has failed successfully
    [StatusCode.SSH_FX_EOF]: "End of file",
    [StatusCode.SSH_FX_NO_SUCH_FILE]: "No such file or directory",
    [StatusCode.SSH_FX_PERMISSION_DENIED]: "Access denied",
    [StatusCode.SSH_FX_FAILURE]: "An error has occured",
    [StatusCode.SSH_FX_BAD_MESSAGE]: "A badly formatted packet was received by the server",
    [StatusCode.SSH_FX_NO_CONNECTION]: "If you are seeing this message, something has gone very wrong as it indicates you are simultaneously connected to and disconnected from the SFTP server.",
    [StatusCode.SSH_FX_CONNECTION_LOST]: "If you are seeing this message, something has gone very wrong as it indicates you are simultaneously connected to and disconnected from the SFTP server.",
    [StatusCode.SSH_FX_OP_UNSUPPORTED]: "Unsupported operation"
}


class SftpStatusError extends RuntimeError {
    constructor(id, messageOrCode = StatusCode.SSH_FX_FAILURE, message = null, language = null) {
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
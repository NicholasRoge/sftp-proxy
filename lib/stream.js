const {spawn} = require('child_process')
const {Duplex} = require('stream')

const {PacketType, StatusCode} = require('./constants')
const {decodePacket, encodePacket} = require('./packet')
const {SftpStatusError} = require('./error')
const {isInteger, Middleware} = require('./util')


class SftpServerProxy extends Duplex {
    constructor(options = {}) {
        super({
            allowHalfOpen: false
        })

        this._requestsMeta = []
        this._requestMetaById = {}
        this._responseQueue = []

        this._requestMiddleware = new Middleware()
        if (options.requestMiddleware) {
            this._requestMiddleware.use(options.requestMiddleware)
        }
        
        this._responseMiddleware = new Middleware()
        if (options.responseMiddleware) {
            this._responseMiddleware.use(options.responseMiddleware)
        }

        this._initSftpServer(options.sftpServer)
    }

    _initSftpServer(options = {}) {
        options.command = options.command || null
        options.args = options.args || []
        options.options = options.options || {}
        if (!options.command) {
            // TODO:  Figure out how to find the path to the system default
            // server binary or how to get the system to spawn an instance 
            // itself
            throw new Error("Not yet implemented")
        }


        this._sftpServer = spawn(options.command, options.args, {
            cwd: options.options.cwd,
            env: options.options.env
        })
        this._sftpServer.stdout.on('data', chunk => {
            const response = decodePacket(chunk)

            const requestId = response.type == PacketType.SSH_FXP_VERSION ? -1 : response.payload.id
            if (!isInteger(requestId)) {
                throw new Error("Response that is not an SSH_FXP_VERSION packet with invalid id was encountered.  Packet content:  %s", JSON.stringify(response, null, 2))
            }

            const requestMeta = this._requestMetaById[requestId]
            requestMeta.response = response
            try {
                this._processResponse(response, requestMeta.request, requestMeta.callback)
            } catch (error) {
                if (requestMeta.request.type === PacketType.SSH_FXP_INIT) {
                    return requestMeta.callback(error)
                }


                try {
                    return this._processResponse(
                        this._convertErrorToStatusPacket(error, requestId),
                        requestMeta.request,
                        requestMeta.callback
                    )
                } catch (innerError) {
                    //  What should be done with the innerError?  Just log it?
                    return requestMeta.callback(error)
                }
            }
        })
        this._sftpServer.on('end', () => this.push(null))
    }

    use(middleware, isRequestMiddleware = true) {
        if (isRequestMiddleware) {
            this._requestMiddleware.use(middleware)
        } else {
            this._responseMiddleware.use(middleware)
        }
    }

    _read(size)  {
        const foo = 'bar'
    }

    _write(chunk, encoding, callback) {
        let request
        try {
            request = decodePacket(chunk)
            this._processRequest(request, error => {
                if (error) {
                    if (!request || request.type === PacketType.SSH_FXP_INIT) {
                        return callback(error)
                    }


                    try {
                        return this._processResponse(
                            this._convertErrorToStatusPacket(error, request.payload.id),
                            request,
                            callback
                        )
                    } catch (innerError) {
                        //  What should be done with the innerError?  Just log it?
                        return callback(error)
                    }
                }

                callback()
            })
        } catch (error) {
            if (!request || request.type === PacketType.SSH_FXP_INIT) {
                return callback(error)
            }


            try {
                return this._processResponse(
                    this._convertErrorToStatusPacket(error, request.payload.id),
                    request,
                    callback
                )
            } catch (innerError) {
                callback(error)
            }
        }
    }

    _final(callback) {
        this._sftpServer.stdin.end()

        callback()
    }

    _processRequest(request, callback) {
        const requestMeta = {
            id: request.type === PacketType.SSH_FXP_INIT ? -1 : request.payload.id,
            response: null,
            request,
            callback
        }
        this._requestMetaById[requestMeta.id] = requestMeta
        this._requestsMeta.push(requestMeta)

        if (request.type === PacketType.SSH_FXP_INIT) {
            // This implementation was coded against version 3 of the SFTP 
            // protocol, so we must force the server to only use that version 
            // (or lower) by making it believe the client is using that version 
            // (or lower)
            request.payload.version = Math.min(3, request.payload.version)
        }

        this._requestMiddleware.run(request, (error, response) => {
            if (error) {
                return callback(error)
            }


            if (response) {
                return this._processResponse(response, callback)
            }


            this._sftpServer.stdin.write(encodePacket(request), e => e && callback(e))
        })
    }

    _processResponse(response, request, callback) {
        if (response.type === PacketType.SSH_FXP_VERSION) {
            // This implementation was coded against version 3 of the SFTP 
            // protocol, so we must force the client to only use that version 
            // (or lower) by making it believe the server is using that version 
            // (or lower)
            response.payload.version = Math.min(3, response.payload.version)
        }

        this._responseMiddleware.run(response, request, error => {
            if (error) {
                return callback(error)
            }


            if (this.push(encodePacket(response))) {
                callback()
            } else {
                this.once('readable', () => callback())
            }
        })
    }

    _convertErrorToStatusPacket(e, requestId) {
        if (e instanceof SftpStatusError) {
            return e.toStatusPacket()
        }

        
        return {
            type: PacketType.SSH_FXP_STATUS,
            payload: {
                id: requestId,
                code: StatusCode.SSH_FX_FAILURE,
                message: e.message,
                language: ""
            }
        } 
    }
}


module.exports = {
    SftpServerProxy
}
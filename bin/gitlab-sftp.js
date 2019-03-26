#!/usr/bin/env node

const fs = require('fs')
const {pipeline} = require('stream')

const SftpServerProxy = require('../lib/SftpServerProxy')
const {PacketType} = require('../lib/constants')


if (fs.existsSync("gitlab-sftp-server.pid")) {
    fs.unlinkSync("gitlab-sftp-server.pid")
}
fs.writeFileSync("gitlab-sftp-server.pid", process.pid)


const sftpServerProxy = new SftpServerProxy({
    sftpServer: {
        command: '/usr/libexec/sftp-server',
        args: ['-d', process.env.HOME]
    }
})
//sftpServerProxy.use(preventOpenMiddleware)

pipeline(
    process.stdin,
    sftpServerProxy,
    process.stdout,
    err => console.error(err)
)


function preventOpenMiddleware(request, next) {
    if (request.type !== PacketType.SSH_FXP_OPEN) {
        return next()
    }


    next(null, {
        type: PacketType.SSH_FXP_STATUS,
        payload: {
            id: request.payload.id,
            code: 3,
            message: "Permission denied",
            language: ""
        }
    })
}
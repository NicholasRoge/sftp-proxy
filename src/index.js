#!/usr/bin/env node

const fs = require('fs')
const {pipeline} = require('stream')

const SftpServerProxy = require('./lib/SftpServerProxy')


fs.unlinkSync("gitlab-sftp-server.pid")
fs.writeFileSync("gitlab-sftp-server.pid", process.pid)

pipeline(
    process.stdin,
    new SftpServerProxy(),
    process.stdout,
    err => console.error(err)
)
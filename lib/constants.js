const PACKET_MAX_SIZE = 34000;

const PacketType = Object.freeze({
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
})

const AttributeFlag = Object.freeze({
    SSH_FILEXFER_ATTR_SIZE:        0x00000001,
    SSH_FILEXFER_ATTR_UIDGID:      0x00000002,
    SSH_FILEXFER_ATTR_PERMISSIONS: 0x00000004,
    SSH_FILEXFER_ATTR_ACMODTIME:   0x00000008,
    SSH_FILEXFER_ATTR_EXTENDED:    0x80000000,
})

const OpenPurposeFlag = Object.freeze({
    SSH_FXF_READ:   0x00000001,
   	SSH_FXF_WRITE:  0x00000002,
   	SSH_FXF_APPEND: 0x00000004,
   	SSH_FXF_CREAT:  0x00000008,
   	SSH_FXF_TRUNC:  0x00000010,
   	SSH_FXF_EXCL:   0x00000020,
})

const StatusCode = Object.freeze({
    SSH_FX_OK: 0,
   	SSH_FX_EOF: 1,
   	SSH_FX_NO_SUCH_FILE: 2,
   	SSH_FX_PERMISSION_DENIED: 3,
   	SSH_FX_FAILURE: 4,
   	SSH_FX_BAD_MESSAGE: 5,
   	SSH_FX_NO_CONNECTION: 6,
   	SSH_FX_CONNECTION_LOST: 7,
   	SSH_FX_OP_UNSUPPORTED: 8,
})

const DefaultErrorMessage = Object.freeze({
    [StatusCode.SSH_FX_OK]: "Success", // AKA, your request has failed successfully
    [StatusCode.SSH_FX_EOF]: "End of file",
    [StatusCode.SSH_FX_NO_SUCH_FILE]: "No such file or directory",
    [StatusCode.SSH_FX_PERMISSION_DENIED]: "Access denied",
    [StatusCode.SSH_FX_FAILURE]: "An error has occured",
    [StatusCode.SSH_FX_BAD_MESSAGE]: "A badly formatted packet was received by the server",
    [StatusCode.SSH_FX_NO_CONNECTION]: "If you are seeing this message, something has gone very wrong as it indicates you are simultaneously connected to and disconnected from the SFTP server.",
    [StatusCode.SSH_FX_CONNECTION_LOST]: "If you are seeing this message, something has gone very wrong as it indicates you are simultaneously connected to and disconnected from the SFTP server.",
    [StatusCode.SSH_FX_OP_UNSUPPORTED]: "Unsupported operation"
})


module.exports = {
    PACKET_MAX_SIZE,
    PacketType,
    AttributeFlag,
    OpenPurposeFlag,
    StatusCode,
    DefaultErrorMessage
}
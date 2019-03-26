function isInteger(n) {
    return Number(parseInt(n)) == n
}

class Middleware {
    constructor(useError = true) {
        this._useError = useError
        this._middleware = []
    }

    use(middleware) {
        if (!Array.isArray(middleware)) {
            middleware = [middleware]
        }

        this._middleware.push(...middleware)
    }

    run(...args) {
        if (args.length === 0) {
            throw new RuntimeException("Callback argument not specified.")
        }


        const callback = args.pop()

        const runnable = this._middleware.reduceRight(
            (next, middleware) => (...nextArgs) => {
                if (this._shouldShortCurcuit(nextArgs)) {
                    return callback(...nextArgs)
                }

                    
                middleware(...args, next)
            },
            callback
        )
        runnable()
    }

    _shouldShortCurcuit(nextArgs) {
        if (nextArgs.length === 0) {
            return false
        }
        
        if (this._useError && (typeof nextArgs[0] !== 'undefined' && nextArgs[0] !== null)) {
            return true
        }


        return nextArgs.length > 1
    }
}

module.exports = {
    isInteger,
    Middleware
}
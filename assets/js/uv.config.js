self.__uv$config = {
    prefix: '/service/',
    bare: '/bare/',
    encodeUrl: Ultraviolet.codec.xor.encode,
    decodeUrl: Ultraviolet.codec.xor.decode,
    handler: '/assets/js/uv.handler.js',
    bundle: '/assets/js/uv.bundle.js',
    config: '/assets/js/uv.config.js',
    sw: '/assets/js/uv.sw.js',
};

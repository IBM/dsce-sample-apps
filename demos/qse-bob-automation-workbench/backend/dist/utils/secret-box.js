import crypto from 'node:crypto';
/**
 * AES-256-GCM envelope with key ids. The first key in SECRETS_KEYS encrypts;
 * all listed keys can decrypt, which supports key rotation.
 */
export class SecretBox {
    keys;
    constructor(spec) {
        this.keys = spec
            .split(',')
            .map((s) => s.trim())
            .filter(Boolean)
            .map((entry) => {
            const idx = entry.indexOf(':');
            if (idx <= 0)
                throw new Error('SECRETS_KEYS entries must look like kid:base64key');
            const kid = entry.slice(0, idx);
            if (!/^[A-Za-z0-9_-]{1,32}$/.test(kid))
                throw new Error('SECRETS_KEYS key id is invalid');
            const key = Buffer.from(entry.slice(idx + 1), 'base64');
            if (key.length !== 32)
                throw new Error(`SECRETS_KEYS key "${kid}" must decode to exactly 32 bytes`);
            return { kid, key };
        });
        if (!this.keys.length)
            throw new Error('SECRETS_KEYS must contain at least one key');
        if (new Set(this.keys.map((k) => k.kid)).size !== this.keys.length)
            throw new Error('SECRETS_KEYS key ids must be unique');
    }
    get activeKeyId() {
        return this.keys[0].kid;
    }
    seal(plaintext) {
        const active = this.keys[0];
        const iv = crypto.randomBytes(12);
        const cipher = crypto.createCipheriv('aes-256-gcm', active.key, iv);
        cipher.setAAD(Buffer.from(active.kid));
        const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
        const sealed = {
            v: 1,
            kid: active.kid,
            iv: iv.toString('base64'),
            tag: cipher.getAuthTag().toString('base64'),
            ct: ct.toString('base64')
        };
        return JSON.stringify(sealed);
    }
    open(serialized) {
        const sealed = JSON.parse(serialized);
        const entry = this.keys.find((k) => k.kid === sealed.kid);
        if (!entry)
            throw new Error(`Encryption key "${sealed.kid}" is not configured`);
        const decipher = crypto.createDecipheriv('aes-256-gcm', entry.key, Buffer.from(sealed.iv, 'base64'));
        decipher.setAAD(Buffer.from(sealed.kid));
        decipher.setAuthTag(Buffer.from(sealed.tag, 'base64'));
        return Buffer.concat([decipher.update(Buffer.from(sealed.ct, 'base64')), decipher.final()]).toString('utf8');
    }
    keyIdOf(serialized) {
        return JSON.parse(serialized).kid;
    }
}
//# sourceMappingURL=secret-box.js.map
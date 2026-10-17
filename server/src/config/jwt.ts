export const getJwtSecret = (): string => {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) {
        throw new Error("JWT_SECRET is not set");
    }
    return secret;
};

export default getJwtSecret;

let counter = 1;
/** Globally unique entity / projectile id (fits comfortably in a double for the lifetime of a server). */
export const nextId = () => counter++;

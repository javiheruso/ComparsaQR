const password = process.argv[2] || "admin123";

console.log("\n--- Admin Password ---");
console.log(`Password: ${password}`);
console.log("\nCopy this to your .env file:");
console.log(`ADMIN_PASSWORD="${password}"`);

export function notFoundHandler(_req, res) {
    res.status(404).json({ error: "Not Found" });
}
export function errorHandler(err, _req, res, _next) {
    console.error(err);
    const message = process.env.NODE_ENV === "production"
        ? "Internal Server Error"
        : err instanceof Error
            ? err.message
            : String(err);
    res.status(500).json({ error: message });
}
//# sourceMappingURL=error-handler.js.map

exports.isLanugage = (txt) => {
    const l = txt.toLowerCase();
    const languages = {
        "javascript": "js",
        "typescript": "ts"
    };
    if (Object.values(languages).includes(l)) return l;
    if (languages[l]) return languages[l];
    return false;
}

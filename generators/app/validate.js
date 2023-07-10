
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

exports.promptExtId = (txt) => {
    const res = txt.match(/[a-z0-9]/g);
    if (res && res.join('') == txt) return true;
    return `Only a-z and 0-9 (no uppercase letters or special characters)`;
}

exports.formatExtId = (extName) => extName.toLowerCase().match(/[a-z0-9]/g).join('');

exports.filterVSCodeInit = (ans) => Object.fromEntries(ans.map(k => [k,true]));

exports.usesPort = (extensionConfig) =>
    extensionConfig.vscode.init['httpserver'] ||
    extensionConfig.vscode.init['browser'] ||
    extensionConfig.expressServer;

exports.usesPkgManager = (extensionConfig) =>
    extensionConfig.lang == 'ts' ||
    this.extensionConfig.expressServer;

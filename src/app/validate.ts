import {ExtensionConfig} from "./types";

export const isLanugage = (txt:String) => {
    const l = txt.toLowerCase();
    const languages:{[_:string]:string} = {
        "javascript": "js",
        "typescript": "ts"
    };
    if (Object.values(languages).includes(l)) return l;
    if (languages[l]) return languages[l];
    return false;
}
export const isPackageManager = (txt:string, choices:string[]) => {
    const m = txt.toLowerCase();
    if (choices.includes(m)) return m;
    return false;
}

export const promptExtId = (txt:string) => {
    const res = txt.match(/[a-z0-9]/g);
    if (res && res.join('') == txt) return true;
    return `Only a-z and 0-9 (no uppercase letters or special characters)`;
}

export const formatExtId = (extName:string) => extName.toLowerCase().match(/[a-z0-9]/g)?.join('');
export const formatExtForPackage = (s:string) => s.replaceAll(/ +/g, "-");

export const filterDevEnvInit = (ans:string[]) => Object.fromEntries(ans.map(k => [k,true]));

export const usesPort = (extConf:ExtensionConfig) =>
    extConf.devEnv?.init!['httpserver'] ||
    extConf.devEnv?.init!['browser'] ||
    extConf.expressServer;

export const usesPkgManager = (extConf:ExtensionConfig) =>
    extConf.lang == 'ts' ||
    extConf.expressServer ||
    extConf.devEnv?.typ == 'runcli';

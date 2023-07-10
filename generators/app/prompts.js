const validate = require('./validate');

exports.askForExt = (generator, extensionConfig) => {
    if (generator.options['quick']) {
        extensionConfig.extName = generator.appname;
        extensionConfig.extId = generator.appname.toLowerCase().match(/[a-z0-9]/g).join('')
        return Promise.resolve();
    }

    return generator.prompt([
        {name: 'extName', message: 'Extension name:', default:generator.appname},
        { name: 'extId', message: 'Extension Id:',
        default: ({extName}) => extName.toLowerCase().match(/[a-z0-9]/g).join(''),
        validate(txt) {
            const res = txt.match(/[a-z0-9]/g);
            if (res && res.join('') == txt) return true;
            return `Only a-z and 0-9 (no uppercase letters or special characters)`;
        } }
    ]).then(Q => {
        extensionConfig.extName = Q.extName;
        extensionConfig.extId = Q.extId;
    });
}

exports.askForFolder = (generator, extensionConfig) => {
    if (generator.options['quick']) {
        extensionConfig.newFolder = true;
        return Promise.resolve();
    }

    return generator.prompt(
        { name: 'newFolder', message: `Create in new folder?`, type:'expand',
        choices: ({extName}) => [
            { key: 'y', name: `Create a new folder (${extName}).`, value: true, short: 'Yes' },
            { key: 'n', name: 'Populate current folder', value: false, short: 'No' }
        ], default: 0 }
    ).then(Q => {
        extensionConfig.newFolder = Q.newFolder
    });
}

exports.askForGit = (generator, extensionConfig) => {
    const {git} = generator.options;
    if (git != undefined) {
        extensionConfig.gitInit = git;
        return Promise.resolve();
    }

    if (generator.options['quick']) {
        extensionConfig.gitInit = true;
        return Promise.resolve();
    }

    return generator.prompt(
        { name: 'gitInit', message: 'Initialize a git repo?', type:'confirm', default:true }
    ).then(Q => {
        extensionConfig.gitInit = Q.gitInit;
    })
}

exports.askForLang = (generator, extensionConfig) => {
    const {lang} = generator.options;
    if (lang && validate.isLanugage(lang)) {
        extensionConfig.lang = lang;
        return Promise.resolve();
    }

    if (generator.options['quick']) {
        extensionConfig.lang = 'js';
        return Promise.resolve();
    }
    
    return generator.prompt(
        { name: 'lang', type: 'list', choices: [
            { name: 'javascript', value: 'js' },
            { name: 'typescript (node project compiled to js)', value: 'ts' }   
        ]}
    ).then(Q => {
        extensionConfig.lang = Q.lang;
    });
}

exports.askForSourcePath = (generator, extensionConfig) => {
    const when = extensionConfig.lang == 'ts';
    if (!when) return Promise.resolve();

    const {srcPath} = generator.options;
    if (srcPath) {
        extensionConfig.srcPath = srcPath;
        return Promise.resolve();
    }

    if (generator.options['quick']) {
        extensionConfig.srcPath = 'src';
        return Promise.resolve();
    }
    
    return generator.prompt(
        { name: 'srcPath', message: 'What path to src files?', default:'src' }
    ).then(Q => {
        extensionConfig.srcPath = Q.srcPath;
    });
}

//TODO maybe have support for other editors
exports.askForVSCode = (generator, extensionConfig) => {
    if (generator.options['quick']) {
        extensionConfig.vscode = {
            init: {}
        };
        return Promise.resolve();
    }

    const express = generator.options['expressServer'];
    const httpTack = express?' (Express)':express==0?' (Python)':'';
    
    return generator.prompt([
        { name: 'init', message: 'Initialize dev env for vscode?', type:'checkbox',
        choices: () => [
                { name: 'Launch dev browser', value: 'browser' },
                { name: `Run dev HTTP server on startup${httpTack}`, value: 'httpserver' }
            ].concat(extensionConfig.lang=='ts'?
                { name: 'Run typescript compiler on startup', value: 'tsc' }
        :[]),
        filter: (ans) => Object.fromEntries(ans.map(k => [k,true]))
        },
        { name: 'browserType', message: 'What browser to use?', type:'list', choices: [
            { name: 'Chrome', value: 'chrome' },
            { name: 'Edge', value: 'msedge' }
        ], when: ({init}) => init['browser']
        },
        { name: 'serverType', message: 'What http server to use?', type:'list',
        choices: () => [
                { name: 'Python http.server', value: 'py' }
            ].concat(express!=0?
                { name: 'Node express server', value: 'express' }
        :[]),
        when: ({init}) => init['httpserver'] && express===undefined
        }
    ]).then(Q => {
        extensionConfig.vscode = Q;
        if (express) extensionConfig.vscode.serverType = 'express';
    });
}

exports.askForExpress = (generator, extensionConfig) => {
    const express = generator.options['expressServer'];
    if (express != undefined) {
        extensionConfig.expressServer = express;
        return Promise.resolve();
    }
    //if you selected to use the express server in vscode, create the express server
    if (extensionConfig.vscode.serverType == 'express') {
        extensionConfig.expressServer = true;
        return Promise.resolve();
    }
    //if you selected to use a different server in vscode, don't ask this question
    if (extensionConfig.vscode.init['httpserver']) return Promise.resolve();

    if (generator.options['quick']) {
        extensionConfig.expressServer = true;
        return Promise.resolve();
    }

    return generator.prompt(
        { name: 'expressServer', message:'Create Node Express server?', type:'confirm' }
    ).then(Q => {
        extensionConfig.expressServer = Q.expressServer;
    });
}

exports.askForPort = (generator, extensionConfig) => {
    const when = extensionConfig.vscode.init['httpserver'] || extensionConfig.vscode.init['browser'] || extensionConfig.expressServer;
    if (generator.options['quick'] && when) {
        extensionConfig.devPort = '5010';
        return Promise.resolve();
    }
    
    return generator.prompt(
        { name: 'devPort' , message: 'Dev Http port:', default: '5010', when }
    ).then(Q => {
        extensionConfig.devPort = Q.devPort;
    });
}

exports.askForPkgManager = (generator, extensionConfig) => {
    if (generator.options['quick'] && generator.usesPkgManager()) {
        extensionConfig.pkgManager = 'npm';
        return Promise.resolve();
    }
    
    return generator.prompt(
        { name: 'pkgManager', message: 'What package manager to use?', type: 'list', choices: [
            'npm'
        ], when: generator.usesPkgManager() }
    ).then(Q => {
        extensionConfig.pkgManager = Q.pkgManager;
    });
}

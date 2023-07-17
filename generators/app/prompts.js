const validate = require('./validate');
const chalk = require('chalk');
const which = require('which');

exports.askForExt = (generator, extensionConfig) => {
    if (generator.options['quick']) {
        extensionConfig.extName = generator.appname;
        extensionConfig.extId = validate.formatExtId(generator.appname);
        return Promise.resolve();
    }

    return generator.prompt([
        {name: 'extName', message: 'Extension name:', default:generator.appname},
        { name: 'extId', message: 'Extension Id:',
        default: ({extName}) => validate.formatExtId(extName),
        validate: validate.promptExtId }
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

const askForVSCode = (generator, extensionConfig) => {
    const express = generator.options['expressServer'];
    const httpTack = express?' (Express)':express==false?' (Python)':'';
    
    return generator.prompt([
        { name: 'init', message: 'options for vscode dev env:', type:'checkbox',
        choices: () => [
                { name: 'Launch dev browser', value: 'browser', short:'Browser' },
                { name: `Run dev HTTP server on startup${httpTack}`, value: 'httpserver', short:'HTTP Server' }
            ].concat(extensionConfig.lang=='ts'?
                { name: 'Run typescript compiler on startup', value: 'tsc', short:'TypeScript Compiler' }
        :[]), filter:validate.filterDevEnvInit
        },
        { name: 'serverType', message: 'What http server to use?', type:'list',
        choices: () => [
                { name: 'Python http.server', value: 'py' }
            ].concat(express!=0?
                { name: 'Node express server', value: 'express' }
        :[]),
        when: (Q) => Q.init['httpserver'] && express===undefined
        }
    ]);
}
const askForRunCLI = (generator, extensionConfig) => {
    return generator.prompt([
        { name: 'init', message: 'options for run cli dev env', type:'checkbox', choices: [
            { name: '(browser) open the test in browser', value: 'browser', short:'browser' }
        ], filter:validate.filterDevEnvInit}
    ])
}
exports.askForDevEnv = async (generator, extensionConfig) => {
    extensionConfig.devEnv = {
        typ: null,
        init: {}
    };
    
    if (generator.options['quick']) {
        extensionConfig.devEnv = {
            typ: 'runcli',
            init: {
                browser: true
            },
            browserType: 'chrome',
        };
        return ;
    }

    const {devEnv} = await generator.prompt(
        { name: 'devEnv', message: 'What development environment do you want to use?', type:'list', choices: [
            { name: 'VSCode', value: 'vscode' },
            { name: 'package manager run cli', value: 'runcli' },
            { name: 'None', value:null }
        ] }
    );
    if (devEnv == null) return ;
    var Q;
    if (devEnv == 'vscode') Q = await askForVSCode(generator, extensionConfig);
    if (devEnv == 'runcli') Q = await askForRunCLI(generator, extensionConfig);

    //shared prompts
    const {browserType} = await generator.prompt(
        { name: 'browserType', message: 'What browser to use?', type:'list', choices: [
            { name: 'Chrome', value: 'chrome' },
            { name: 'Edge', value: 'msedge' }
        ], when: Q.init['browser']
        }
    );
    extensionConfig.devEnv = {
        typ: devEnv,
        init: Q.init,
        browserType,
        serverType: generator.options['expressServer']?'express': Q.serverType
    };
}

exports.askForExpress = (generator, extensionConfig) => {
    const express = generator.options['expressServer'];
    if (express != undefined) {
        extensionConfig.expressServer = express;
        return Promise.resolve();
    }
    //if you selected to use the express server in devEnv, create the express server
    if (extensionConfig.devEnv.serverType == 'express') {
        extensionConfig.expressServer = true;
        return Promise.resolve();
    }
    //if you selected to use a different server in devEnv, don't ask this question
    if (extensionConfig.devEnv.init['httpserver']) return Promise.resolve();

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
    const when = validate.usesPort(extensionConfig);
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
    const when = validate.usesPkgManager(extensionConfig);
    if (generator.options['quick'] && when) {
        extensionConfig.pkgManager = 'npm';
        return Promise.resolve();
    }
    
    return generator.prompt(
        { name: 'pkgManager', message: 'What package manager to use?', type: 'list', choices: [
            'npm'
        ], when }
    ).then(Q => {
        extensionConfig.pkgManager = Q.pkgManager;
    });
}

exports.showClosingMessage = (log, extensionConfig) => {
    const {devEnv} = extensionConfig;
    if (devEnv.typ == 'vscode') {
        if (devEnv.init.browser) log('Run browser test with: '+chalk.green('f5'));
        const {httpserver, tsc} = devEnv.init;
        if (httpserver || tsc) {
            log((tsc?'TypeScript Compiler':'')+
                (httpserver&&tsc?' and ':'')+
                (httpserver?'HTTP Server':'')+
                ' will run on startup');
        }
    } else if (devEnv.typ == 'runcli') {
        if (devEnv.init.browser) log('Run browser test with: '+chalk.blue(extensionConfig.pkgManager+' run browser'));
        if (extensionConfig.lang == 'ts') log('Run TypeScript Compiler with: '+chalk.blueBright('npx tsc --watch'));
        if (extensionConfig.expressServer) log('Run HTTP Server with: '+chalk.blueBright('node server.js'));
    }
}

exports.askOpenWithCode = async (generator, extensionConfig) => {
    if (generator.options['quick']) return ;
    const codeConcreate = await which('code').catch(() => undefined);

    if (generator.options['vscode']) {
        if (codeConcreate) {
            generator.log(`Opening destination in vscode.`);
            generator.spawnCommand(codeConcreate, [generator.destinationPath()]);
        } else {
            generator.log('Couldn\'t find '+chalk.blue('code')+' command');
        }
        return ;
    }
    if (!codeConcreate) return ;

    const {openCode} = await generator.prompt(
        { name:'openCode', message: 'Open in VSCode', type:'confirm', default:false }
    );

    if (openCode) {
        generator.spawnCommand(codeConcreate, [generator.destinationPath()]);
    }
}

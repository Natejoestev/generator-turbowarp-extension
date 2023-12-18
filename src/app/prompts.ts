
import * as validate from "./validate";
import * as chalk from 'chalk';
import which from 'which';
import {ExtensionConfig,Gen} from "./types";

const packageManagers = [
    'npm'
    //TODO add more package managers
];

export const askForExt = (generator:Gen, extConf:ExtensionConfig) => {
    if (generator.options['quick']) {
        extConf.extName = generator.appname;
        extConf.extId = validate.formatExtId(generator.appname);
        return Promise.resolve();
    }

    return generator.prompt([
        {name: 'extName', message: 'Extension name:', default:generator.appname},
        { name: 'extId', message: 'Extension Id:',
        default: ({extName}:{extName:string}) => validate.formatExtId(extName),
        validate: validate.promptExtId }
    ]).then(Q => {
        extConf.extName = Q.extName;
        extConf.extId = Q.extId;
    });
}

export const askForFolder = (generator:Gen,extConf:ExtensionConfig) => {
    if (generator.options['quick']) {
        extConf.newFolder = true;
        return Promise.resolve();
    }

    const newName = chalk.bold.green(`./${extConf.extName}`);

    return generator.prompt(
        { name: 'newFolder', message: `Create in new folder? (${newName})`, type:'expand',
        choices: () => [
            { key: 'y', name: 'Create a new folder.', value: true, short: 'Yes' },
            { key: 'n', name: 'Populate current folder', value: false, short: 'No' }
        ], default: 0 }
    ).then(Q => {
        extConf.newFolder = Q.newFolder
    });
}

export const askForGit = (generator:Gen,extConf:ExtensionConfig) => {
    const {git} = generator.options;
    if (git != undefined) {
        extConf.gitInit = git;
        return Promise.resolve();
    }

    if (generator.options['quick']) {
        extConf.gitInit = true;
        return Promise.resolve();
    }

    return generator.prompt(
        { name: 'gitInit', message: 'Initialize a git repo?', type:'confirm', default:true }
    ).then(Q => {
        extConf.gitInit = Q.gitInit;
    })
}

export const askForLang = (generator:Gen,extConf:ExtensionConfig) => {
    const {lang} = generator.options;
    if (lang && validate.isLanugage(lang)) {
        extConf.lang = lang;
        return Promise.resolve();
    }

    if (generator.options['quick']) {
        extConf.lang = 'js';
        return Promise.resolve();
    }
    
    return generator.prompt(
        { name: 'lang', type: 'list', choices: [
            { name: 'javascript', value: 'js' },
            { name: 'typescript (node project compiled to js)', value: 'ts' }   
        ]}
    ).then(Q => {
        extConf.lang = Q.lang;
    });
}

export const askForSourcePath = (generator:Gen,extConf:ExtensionConfig) => {
    const when = extConf.lang == 'ts';
    if (!when) return Promise.resolve();

    const {srcPath} = generator.options;
    if (srcPath) {
        extConf.srcPath = srcPath;
        return Promise.resolve();
    }

    if (generator.options['quick']) {
        extConf.srcPath = 'src';
        return Promise.resolve();
    }
    
    return generator.prompt(
        { name: 'srcPath', message: 'What path to src files?', default:'src' }
    ).then(Q => {
        extConf.srcPath = Q.srcPath;
    });
}

const askForVSCode = (generator:Gen,extConf:ExtensionConfig) => {
    const express = generator.options['expressServer'];
    const httpTack = express?' (Express)':express==false?' (Python)':'';
    
    return generator.prompt([
        { name: 'init', message: 'options for vscode dev env:', type:'checkbox',
        choices: () => [
                { name: 'Launch dev browser', value: 'browser', short:'Browser' },
                { name: `Run dev HTTP server on startup${httpTack}`, value: 'httpserver', short:'HTTP Server' }
            ].concat(extConf.lang=='ts'?
                { name: 'Run typescript compiler on startup', value: 'tsc', short:'TypeScript Compiler' }
        :[]), filter:validate.filterDevEnvInit
        },
        { name: 'serverType', message: 'What http server to use?', type:'list',
        choices: () => [
                { name: 'Python http.server', value: 'py' }
            ].concat(express?
                { name: 'Node express server', value: 'express' }
        :[]),
        when: (Q) => Q.init['httpserver'] && express===undefined
        }
    ]);
}
const askForRunCLI = (generator:Gen,extConf:ExtensionConfig) => {
    return generator.prompt([
        { name: 'init', message: 'options for run cli dev env', type:'checkbox', choices: [
            { name: '(browser) open the test in browser', value: 'browser', short:'browser' }
        ], filter:validate.filterDevEnvInit}
    ])
}
export const askForDevEnv = async (generator:Gen,extConf:ExtensionConfig) => {
    extConf.devEnv = {
        typ: null,
        init: {}
    };
    
    if (generator.options['quick']) {
        extConf.devEnv = {
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
    if (devEnv == 'vscode') Q = await askForVSCode(generator,extConf);
    if (devEnv == 'runcli') Q = await askForRunCLI(generator,extConf);

    //shared prompts
    const {browserType} = await generator.prompt(
        { name: 'browserType', message: 'What browser to use?', type:'list', choices: [
            { name: 'Chrome', value: 'chrome' },
            { name: 'Edge', value: 'msedge' }
        ], when: Q.init['browser']
        }
    );
    extConf.devEnv = {
        typ: devEnv,
        init: Q.init,
        browserType,
        serverType: generator.options['expressServer']?'express': Q.serverType
    };
}

export const askForExpress = (generator:Gen,extConf:ExtensionConfig) => {
    const express = generator.options['expressServer'];
    if (express != undefined) {
        extConf.expressServer = express;
        return Promise.resolve();
    }
    //if you selected to use the express server in devEnv, create the express server
    if (extConf.devEnv?.serverType == 'express') {
        extConf.expressServer = true;
        return Promise.resolve();
    }
    //if you selected to use a different server in devEnv, don't ask this question
    if (extConf.devEnv?.init!['httpserver']) return Promise.resolve();

    if (generator.options['quick']) {
        extConf.expressServer = true;
        return Promise.resolve();
    }

    return generator.prompt(
        { name: 'expressServer', message:'Create Node Express server?', type:'confirm' }
    ).then(Q => {
        extConf.expressServer = Q.expressServer;
    });
}

export const askForPort = (generator:Gen,extConf:ExtensionConfig) => {
    const when = validate.usesPort(extConf);
    if (generator.options['quick'] && when) {
        extConf.devPort = '5010';
        return Promise.resolve();
    }
    
    return generator.prompt(
        { name: 'devPort' , message: 'Dev Http port:', default: '5010', when }
    ).then(Q => {
        extConf.devPort = Q.devPort;
    });
}

export const askForPkgManager = (generator:Gen,extConf:ExtensionConfig) => {
    if (!validate.usesPkgManager(extConf)) return Promise.resolve();
    const choices = packageManagers;

    const pmOption = generator.options.packageManager;
    if (pmOption && validate.isPackageManager(pmOption, choices)) {
        extConf.pkgManager = pmOption;
        return Promise.resolve();
    }
    if (generator.options['quick']) {
        extConf.pkgManager = 'npm';
        return Promise.resolve();
    }
    
    return generator.prompt(
        { name: 'pkgManager', message: 'What package manager to use?', type: 'list', choices}
    ).then(Q => {
        extConf.pkgManager = Q.pkgManager;
    });
}

export const showClosingMessage = (generator:Gen, extConf:ExtensionConfig) => {
    const {devEnv} = extConf;
    if (devEnv?.typ == 'vscode') {
        if (devEnv.init?.browser) generator.log('Run browser test with: '+chalk.green('f5'));
        const {httpserver, tsc} = devEnv.init!;
        if (httpserver || tsc) {
            generator.log((tsc?'TypeScript Compiler':'')+
                (httpserver&&tsc?' and ':'')+
                (httpserver?'HTTP Server':'')+
                ' will run on startup');
        }
    } else if (devEnv?.typ == 'runcli') {
        if (devEnv.init?.browser) generator.log('Run browser test with: '+chalk.blue(extConf.pkgManager+' run browser'));
        if (extConf.lang == 'ts') generator.log('Run TypeScript Compiler with: '+chalk.blueBright('npx tsc --watch'));
        if (extConf.expressServer) generator.log('Run HTTP Server with: '+chalk.blueBright('node server.js'));
    }
}

export const askOpenWithCode = async (generator:Gen,extConf:ExtensionConfig) => {
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

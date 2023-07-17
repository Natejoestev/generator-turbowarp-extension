const Generator = require('yeoman-generator');
const path = require('path');
const chalk = require('chalk');
const prompts = require('./prompts');
const validate = require('./validate');

function camelCase(str) {
    // https://stackoverflow.com/a/2970667
    return str.replace(/(?:^\w|[A-Z]|\b\w|\s+)/g, function(match, index) {
        if (+match === 0) return "";
        return index === 0 ? match.toLowerCase() : match.toUpperCase();
    });
}

module.exports = class extends Generator {
    constructor(args, opts) {
        super(args, opts);
        this.description = 'Generates an extension for Turbowarp to start development.';

        this.option('quick', { type: Boolean, alias:'q', description: 'Quick mode, skip all optional prompts and use defaults' });
        this.option('lang', { type: String, alias:'l', description: 'Language, the programing language to use'});
        this.option('git', { type: Boolean, description: 'Init a Git repository'});
        this.option('srcPath', { type: String, alias:'src', description: 'Directory to place typescript source files in.'});
        this.option('expressServer', { type: Boolean, description: 'use the express server'});
        this.option('vscode', { type: Boolean, description: 'open in vscode'});
        //TODO add more cli options (dev env, browser)
    }

    initializing() {
        const turbowarp = chalk.bold.hex('#ff4c4c');
        this.log('Welcome, to the '+turbowarp('TurboWarp Extension')+' Generator.');

        this.extensionConfig = Object.create(null);
    }

    async prompting() {
        await prompts.askForExt(this, this.extensionConfig);
        await prompts.askForFolder(this, this.extensionConfig);
        await prompts.askForGit(this, this.extensionConfig);
        await prompts.askForLang(this, this.extensionConfig);
        await prompts.askForSourcePath(this, this.extensionConfig);
        await prompts.askForDevEnv(this, this.extensionConfig);
        await prompts.askForExpress(this, this.extensionConfig);
        await prompts.askForPort(this, this.extensionConfig);
        await prompts.askForPkgManager(this, this.extensionConfig);
    }

    configuring () {
        if (this.extensionConfig.newFolder) {
            this.destinationRoot(path.resolve(this.destinationPath(), this.extensionConfig.extName));
        }
    }

    writing() {
        const {devEnv, devPort, lang} = this.extensionConfig;
        if (devEnv.typ == 'vscode') {
            if (devEnv.init['httpserver'] || devEnv.init['tsc']) {
                const content = this.fs.readJSON(this.templatePath('vscode', 'tasks.json'));
                if (devEnv.serverType == 'py') {
                    content.tasks.push(
                        JSON.parse(this.fs.read(
                            this.templatePath('vscode', 'http-python-task.json')
                        ).replaceAll('<%= devPort %>', devPort)) //REMAKE
                    );
                } else if (devEnv.serverType == 'express') {
                    content.tasks.push(this.fs.readJSON(
                        this.templatePath('vscode', 'http-express-task.json')
                    ));
                }
                if (devEnv.init['tsc']) {
                    content.tasks.push(
                        this.fs.readJSON(this.templatePath('vscode', 'tsc-task.json'))
                    );
                }
                this.fs.writeJSON(
                    this.destinationPath('.vscode', 'tasks.json'),
                    content
                );
            }
            if (devEnv.init['browser']) {
                this.fs.copyTpl(
                    this.templatePath('vscode', 'browser-launch.json'),
                    this.destinationPath('.vscode', 'launch.json'),
                    this.extensionConfig
                );
            }
        }
        if (this.extensionConfig.expressServer) {
            this.fs.copyTpl(
                this.templatePath('server.js'),
                this.destinationPath('server.js'),
                this.extensionConfig
            );
        }
        if (validate.usesPkgManager(this.extensionConfig)) {
            const pkgDest = this.destinationPath('package.json')
            if (!this.fs.exists(pkgDest)) {
                this.fs.copyTpl(
                    this.templatePath('package.json'),
                    pkgDest,
                    this.extensionConfig //ERROR extname can contain spaces, maybe just replace with -'s
                );
            }
            const scripts = {};
            if (devEnv.typ == 'runcli' && devEnv.init['browser']) {
                scripts['browser'] = `${devEnv.browserType} https://turbowarp.org/editor?extension=http://localhost:${devPort}/extension.js`;
            }
            if (Object.keys(scripts).length!=0) {
                const pkg = this.fs.readJSON(pkgDest);
                pkg['scripts'] = scripts;
                this.fs.writeJSON(pkgDest, pkg, undefined, '  ');
            }
        }
        const className = camelCase(this.extensionConfig.extName);
        if (lang == 'js') {
            this.fs.copyTpl(
                this.templatePath('js', 'extension.js'),
                this.destinationPath('extension.js'),
                Object.assign({className}, this.extensionConfig)
            );
        } else if (lang == 'ts') {
            this.fs.copyTpl(
                this.templatePath('ts', 'tsconfig.json'),
                this.destinationPath('tsconfig.json'),
                this.extensionConfig
            );
            this.fs.copyTpl(
                this.templatePath('ts', 'main.ts'),
                this.destinationPath(this.extensionConfig.srcPath, 'main.ts'),
                Object.assign({className}, this.extensionConfig)
            );
        }
    }

    install() {
        const packages = [];
        if (this.extensionConfig.lang == 'ts') {
            packages.push('typescript', '@turbowarp/types');
        }
        if (this.extensionConfig.expressServer) {
            packages.push('express');
        }
        if (validate.usesPkgManager(this.extensionConfig)) {
            if (this.extensionConfig.pkgManager=='npm') {
                if (packages.length>0) this.spawnCommandSync('npm', ['install', ...packages, '-y', '--quiet', '--save-dev']);
            //} else if (this.extensionConfig.pkgManager=='yarn') {
            //    this.spawnCommand('yarn', ['add', ...packages, '--dev']);
            }
        }
        if (this.extensionConfig.gitInit) {
            this.spawnCommand('git', ['init', '--quiet', '--initial-branch=main']);
        }
    }

    async end() {
        if (this.options['quick']) return ;
        prompts.showClosingMessage(this.log, this.extensionConfig);
        //TODO move OpenCode to prompt &| check for devEnv=='runcli'
        await prompts.askOpenWithCode(this, this.extensionConfig);
    }
};
const Generator = require('yeoman-generator');
const path = require('path');
const chalk = require('chalk');
const prompts = require('./prompts');

function camelCase(str) {
    // https://stackoverflow.com/a/2970667
    return str.replace(/(?:^\w|[A-Z]|\b\w|\s+)/g, function(match, index) {
        if (+match === 0) return "";
        return index === 0 ? match.toLowerCase() : match.toUpperCase();
    });
}

module.exports = class extends Generator {
    usesPkgManager() {
        return this.extensionConfig.lang == 'ts' || this.extensionConfig.expressServer;
    };

    constructor(args, opts) {
        super(args, opts);
        this.description = 'Generates an extension for Turbowarp to start development.';

        this.option('quick', { type: Boolean, alias: 'q', description: 'Quick mode, skip all optional prompts and use defaults' });
        this.option('lang', { type: String, alias:'l', description: 'Language, the programing language to use'});
        this.option('git', { type: Boolean, description: 'Init a Git repository'});
        //TODO add more cli options (srcPath)
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
        await prompts.askForVSCode(this, this.extensionConfig);
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
        const {vscode, lang} = this.extensionConfig;
        if (vscode.init['httpserver'] || vscode.init['tsc']) {
            const content = this.fs.readJSON(this.templatePath('vscode', 'tasks.json'));
            if (vscode.serverType == 'py') {
                content.tasks.push(
                    JSON.parse(this.fs.read(
                        this.templatePath('vscode', 'http-python-task.json')
                    ).replaceAll('<%= devPort %>', this.extensionConfig.devPort)) //REMAKE
                );
            } else if (vscode.serverType == 'express') {
                content.tasks.push(this.fs.readJSON(
                    this.templatePath('vscode', 'http-express-task.json')
                ));
                this.fs.copyTpl(
                    this.templatePath('server.js'),
                    this.destinationPath('server.js'),
                    this.extensionConfig
                );
            }
            if (vscode.init['tsc']) {
                content.tasks.push(
                    this.fs.readJSON(this.templatePath('vscode', 'tsc-task.json'))
                );
            }
            this.fs.writeJSON(
                this.destinationPath('.vscode', 'tasks.json'),
                content
            );
        }
        if (vscode.init['browser']) {
            this.fs.copyTpl(
                this.templatePath('vscode', 'browser-launch.json'),
                this.destinationPath('.vscode', 'launch.json'),
                this.ops
            );
        }
        if (this.usesPkgManager()) {
            this.fs.copyTpl(
                this.templatePath('package.json'),
                this.destinationPath('package.json'),
                this.extensionConfig //ERROR extname can contain spaces, maybe just replace with -'s
            );
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
        if (this.extensionConfig.serverType == 'express') {
            packages.push('express');
        }
        if (this.usesPkgManager()) {
            if (this.extensionConfig.pkgManager=='npm') {
                this.spawnCommand('npm', ['install', ...packages, '-y', '--quiet', '--save-dev']);
            //} else if (this.ops.pkgManager=='yarn') {
            //    this.spawnCommand('yarn', ['add', ...packages, '--dev']);
            }
        }
        if (this.extensionConfig.gitInit) {
            this.spawnCommand('git', ['init', '--quiet', '--initial-branch=main']); //TODO option for initial git branch
        }
    }

    end() {
        //BUG this prompt get's interrupted by npm install commands
        const {openCode} = this.prompt([
            { name:'openCode', message: 'Open in VSCode', type:'confirm', default:false }
        ]);
        if (openCode) {
            this.spawnCommand('code', [this.destinationPath()]);
            //REMAKE find `code` concrete command
        }
    }
};
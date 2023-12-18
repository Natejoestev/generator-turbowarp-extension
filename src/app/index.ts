import Generator from 'yeoman-generator';;
import * as path from 'path';
import * as chalk from 'chalk';
import * as prompts from './prompts';
import * as validate from './validate';
import {GeneratorOptions, ExtensionConfig} from './types';

function camelCase(str:string):string {
    // https://stackoverflow.com/a/2970667
    return str.replace(/(?:^\w|[A-Z]|\b\w|\s+)/g, function(match, index) {
        if (+match === 0) return "";
        return index === 0 ? match.toLowerCase() : match.toUpperCase();
    });
}

export default class extends Generator<GeneratorOptions> {
    extensionConfig:ExtensionConfig={};

    constructor(args:string|string[], options:GeneratorOptions) {
        super(args, options);
        this.description = 'Generates an extension for Turbowarp to start development.';

        this.option('quick', { type: Boolean, alias:'q', description: 'Quick mode, skip all optional prompts and use defaults' });
        this.option('lang', { type: String, alias:'l', description: 'Language, the programing language to use'});
        this.option('git', { type: Boolean, description: 'Init a Git repository'});
        this.option('srcPath', { type: String, alias:'src', description: 'Directory to place typescript source files in.'});
        this.option('expressServer', { type: Boolean, description: 'use the express server'});
        this.option('vscode', { type: Boolean, description: 'open in vscode'});
        this.option('packageManager', { type: String, alias:'pm', description:'Package manager to use (npm)'})
        //TODO add more cli options (dev env, browser)
    }

    initializing() {
        const turbowarp = chalk.bold.hex('#ff4c4c');
        this.log(`Welcome, to the ${turbowarp('TurboWarp Extension')} Generator.`);

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
            this.destinationRoot(path.resolve(this.destinationPath(), this.extensionConfig.extName!));
        }
    }

    writing() {
        const {devEnv, devPort, lang} = this.extensionConfig;
        if (devEnv?.typ == 'vscode') {
            if (devEnv.init!['httpserver'] || devEnv.init!['tsc']) {
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
                if (devEnv.init!['tsc']) {
                    content.tasks.push(
                        this.fs.readJSON(this.templatePath('vscode', 'tsc-task.json'))
                    );
                }
                this.fs.writeJSON(
                    this.destinationPath('.vscode', 'tasks.json'),
                    content
                );
            }
            if (devEnv.init!['browser']) {
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
                    {...this.extensionConfig,
                        extName:validate.formatExtForPackage(this.extensionConfig.extName!)
                    }
                );
            }
            const scripts:{[_:string]:string} = {};
            if (devEnv?.typ == 'runcli' && devEnv?.init!['browser']) {
                scripts['browser'] = `${devEnv.browserType} https://turbowarp.org/editor?extension=http://localhost:${devPort}/extension.js`;
            }
            if (Object.keys(scripts).length!=0) {
                const pkg = this.fs.readJSON(pkgDest);
                pkg['scripts'] = scripts;
                this.fs.writeJSON(pkgDest, pkg, undefined, '  ');
            }
        }
        const className = camelCase(this.extensionConfig.extName!);
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
                this.destinationPath(this.extensionConfig.srcPath!, 'main.ts'),
                Object.assign({className}, this.extensionConfig)
            );
        }
    }

    install() {
        const packages:string[] = [];
        if (this.extensionConfig.lang == 'ts') {
            packages.push('typescript', '@turbowarp/types');
        }
        if (this.extensionConfig.expressServer) {
            packages.push('express');
        }
        if (validate.usesPkgManager(this.extensionConfig)) {
            this.log(`Using ${this.extensionConfig.pkgManager} to install required packages.`);
            if (this.extensionConfig.pkgManager=='npm') {
                if (packages.length>0) this.spawnCommandSync('npm', ['install', ...packages, '-y', '--quiet', '--save-dev']);
            //TODO add more package managers
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
        prompts.showClosingMessage(this, this.extensionConfig);
        await prompts.askOpenWithCode(this, this.extensionConfig);
    }
};
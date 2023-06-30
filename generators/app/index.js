const Generator = require('yeoman-generator');
const path = require('path');
const chalk = require('chalk');

function camelCase(str) {
    // https://stackoverflow.com/a/2970667
    return str.replace(/(?:^\w|[A-Z]|\b\w|\s+)/g, function(match, index) {
        if (+match === 0) return "";
        return index === 0 ? match.toLowerCase() : match.toUpperCase();
    });
}

module.exports = class extends Generator {
    initializing() {
        const turbowarp = chalk.hex('#ff4c4c');
        this.log('Welcome, to the '+turbowarp.bold('TurboWarp Extension')+' Generator.');
    }

    async prompting() {
        const usePkgManager = ({language, vscodeInit, serverType}) => {
            return language == 'ts' ||
                (vscodeInit['httpserver'] && serverType=='express');
        };
        const {
            extName,extId, newFolder,
            language,srcPath,
            vscodeInit,browserType,serverType,devPort,
            pkgManager
        } = await this.prompt([
            { name: 'extName', message: 'Extension name:', default:this.appname },
            { name: 'extId', message: 'Extension Id:',
            default: ({extName}) => extName.toLowerCase().match(/[a-z0-9]/g).join(''),
            validate(txt) {
                const res = txt.match(/[a-z0-9]/g);
                if (res && res.join('') == txt) return true;
                return `Only a-z and 0-9 (no uppercase letters or special characters)`;
            } },

            { name: 'newFolder', message: `Create in new folder?`, type:'expand',
            choices: ({extName}) => [
                    { key: 'y', name: `Create a new folder (${extName}).`, value: true, short: 'Yes' },
                    { key: 'n', name: 'Populate current folder', value: false, short: 'No' }
            ], default: 0 },

            { name: 'language', type: 'list', choices: [
                { name: 'javascript', value: 'js' },
                { name: 'typescript (node project compiled to js)', value: 'ts' }   
            ] },
            { name: 'srcPath', message: 'What path to src files?', default:'src',
            when: ({language}) => language == 'ts'
            },

            //NOTE maybe have support for other editors
            { name: 'vscodeInit' , message: 'Initialize vscode dev env?', type:'checkbox',
            choices({language}) {
                return [
                    { name: 'Launch dev browser', value: 'browser' },
                    { name: 'Run dev HTTP server on startup', value: 'httpserver' }
                    //NOTE maybe add 'hide unnecessary files' option (settings.json:explorer.exclude)
                ].concat(language!='ts' ? []:
                    { name: 'Run typescript compiler on startup', value: 'tsc' }
                );
            },
            filter: (ans) => Object.fromEntries(ans.map(k => [k,true]))
            },
            { name: 'browserType', message: 'What browser to use?', type:'list', choices: [
                { name: 'Chrome', value: 'chrome' },
                { name: 'Edge', value: 'msedge' }
            ],
            when: ({vscodeInit}) => vscodeInit['browser']
            },
            { name: 'serverType', message: 'What http server to use?', type:'list', choices: [
                { name: 'Python http.server', value: 'py' },
                { name: 'Node express server', value: 'express' }
            ],
            when: ({vscodeInit}) => vscodeInit['httpserver']
            },
            { name: 'devPort' , message: 'Dev Http port:', default: '5010',
            when: ({vscodeInit}) => vscodeInit['httpserver'] || vscodeInit['browser']
            },

            { name: 'pkgManager', message: 'What package manager to use?', type: 'list', choices: [
                'npm'
            ], when: usePkgManager }
        ]);
        this.extName = extName;
        this.extId = extId;
        this.newFolder = newFolder;
        this.language = language;
        this.srcPath = srcPath;
        this.vscodeInit = vscodeInit;
        this.browserType = browserType;
        this.serverType = serverType;
        this.devPort = devPort;
        this.pkgManager = pkgManager;

        //REMAKE somehow pass whole "answer hash"
        this.usesPkgManager = usePkgManager({language, vscodeInit, serverType});
    }

    configuring () {
        if (this.newFolder) {
            this.destinationRoot(path.resolve(this.destinationPath(), this.extName));
        }
    }

    writing() {
        if (this.vscodeInit['httpserver'] || this.vscodeInit['tsc']) {
            const content = this.fs.readJSON(this.templatePath('vscode', 'tasks.json'));
            if (this.vscodeInit['httpserver']) {
                if (this.serverType == 'py') {
                    content.tasks.push(
                        JSON.parse(this.fs.read(
                            this.templatePath('vscode', 'http-python-task.json')
                        ).replaceAll('<%= devPort %>', this.devPort))
                    );
                } else if (this.serverType == 'express') {
                    content.tasks.push(this.fs.readJSON(
                        this.templatePath('vscode', 'http-express-task.json')
                    ));
                    this.fs.copyTpl(
                        this.templatePath('server.js'),
                        this.destinationPath('server.js'),
                        { devPort: this.devPort }
                    );
                }
            }
            if (this.vscodeInit['tsc']) {
                content.tasks.push(
                    this.fs.readJSON(this.templatePath('vscode', 'tsc-task.json'))
                );
            }
            this.fs.writeJSON(
                this.destinationPath('.vscode', 'tasks.json'),
                content
            );
        }
        if (this.vscodeInit['browser']) {
            this.fs.copyTpl(
                this.templatePath('vscode', 'browser-launch.json'),
                this.destinationPath('.vscode', 'launch.json'),
                { devPort: this.devPort, browserType:this.browserType }
            );
        }
        if (this.usesPkgManager) {
            if (this.pkgManager == 'npm') {
                this.fs.copyTpl(
                    this.templatePath('package.json'),
                    this.destinationPath('package.json'),
                    { extName: this.extName } //ERROR extname can contain spaces, maybe just replace with -'s
                );
            }
        }
        const className = camelCase(this.extName);
        if (this.language == 'js') {
            this.fs.copyTpl(
                this.templatePath('js', 'extension.js'),
                this.destinationPath('extension.js'),
                { className, extName:this.extName, extId: this.extId }
            );
        } else if (this.language == 'ts') {
            if (this.pkgManager == 'npm') {
                this.fs.copyTpl(
                    this.templatePath('ts', 'tsconfig.json'),
                    this.destinationPath('tsconfig.json'),
                    { srcPath: this.srcPath }
                );
                this.fs.copyTpl(
                    this.templatePath('ts', 'main.ts'),
                    this.destinationPath(this.srcPath, 'main.ts'),
                    { className, extName:this.extName, extId: this.extId }
                );
            }
        }
    }

    install() {
        if (this.language == 'ts') {
            if (this.pkgManager == 'npm') {
                this.spawnCommand('npm', ['install', 'typescript', '@turbowarp/types', '-y', '--quiet']);
            }
        }
        if (this.vscodeInit['httpserver'] && this.serverType == 'express') {
            if (this.pkgManager=='npm') {
                this.spawnCommand('npm', ['install', 'express', '-y', '--quiet']);
            }
        }
    }

    async end() {
        const {openCode} = await this.prompt([
            { name:'openCode', message: 'Open in VSCode', type:'confirm', default:true }
        ]);
        if (openCode) {
            this.spawnCommand('code', [this.destinationPath()]);
        }
    }
};
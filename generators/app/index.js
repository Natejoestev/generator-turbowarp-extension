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
        const turbowarp = chalk.bold.hex('#ff4c4c');
        this.log('Welcome, to the '+turbowarp('TurboWarp Extension')+' Generator.');
    }

    async prompting() {
        const usePkgManager = ({lang, serverType}) => {
            return lang == 'ts' || serverType=='express';
        };
        const ops = await this.prompt([
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

            { name: 'gitInit', message: 'Initialize a git repo?', type:'confirm', default:true },

            { name: 'lang', type: 'list', choices: [
                { name: 'javascript', value: 'js' },
                { name: 'typescript (node project compiled to js)', value: 'ts' }   
            ] },
            { name: 'srcPath', message: 'What path to src files?', default:'src',
            when: ({lang}) => lang == 'ts'
            },

            //TODO maybe have support for other editors
            { name: 'vscodeInit' , message: 'Initialize vscode dev env?', type:'checkbox',
            choices({lang}) {
                return [
                    { name: 'Launch dev browser', value: 'browser' },
                    { name: 'Run dev HTTP server on startup', value: 'httpserver' }
                ].concat(lang!='ts' ? []:
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
        this.ops = ops;

        this.usesPkgManager = usePkgManager(ops);
    }

    configuring () {
        if (this.ops.newFolder) {
            this.destinationRoot(path.resolve(this.destinationPath(), this.ops.extName));
        }
    }

    writing() {
        if (this.ops.vscodeInit['httpserver'] || this.ops.vscodeInit['tsc']) {
            const content = this.fs.readJSON(this.templatePath('vscode', 'tasks.json'));
            if (this.ops.vscodeInit['httpserver']) {
                if (this.ops.serverType == 'py') {
                    content.tasks.push(
                        JSON.parse(this.fs.read(
                            this.templatePath('vscode', 'http-python-task.json')
                        ).replaceAll('<%= devPort %>', this.ops.devPort))
                    );
                } else if (this.ops.serverType == 'express') {
                    content.tasks.push(this.fs.readJSON(
                        this.templatePath('vscode', 'http-express-task.json')
                    ));
                    this.fs.copyTpl(
                        this.templatePath('server.js'),
                        this.destinationPath('server.js'),
                        this.ops
                    );
                }
            }
            if (this.ops.vscodeInit['tsc']) {
                content.tasks.push(
                    this.fs.readJSON(this.templatePath('vscode', 'tsc-task.json'))
                );
            }
            this.fs.writeJSON(
                this.destinationPath('.vscode', 'tasks.json'),
                content
            );
        }
        if (this.ops.vscodeInit['browser']) {
            this.fs.copyTpl(
                this.templatePath('vscode', 'browser-launch.json'),
                this.destinationPath('.vscode', 'launch.json'),
                this.ops
            );
        }
        if (this.usesPkgManager) {
            this.fs.copyTpl(
                this.templatePath('package.json'),
                this.destinationPath('package.json'),
                this.ops //ERROR extname can contain spaces, maybe just replace with -'s
            );
        }
        const className = camelCase(this.ops.extName);
        if (this.ops.lang == 'js') {
            this.fs.copyTpl(
                this.templatePath('js', 'extension.js'),
                this.destinationPath('extension.js'),
                Object.assign({className}, this.ops)
            );
        } else if (this.ops.lang == 'ts') {
            this.fs.copyTpl(
                this.templatePath('ts', 'tsconfig.json'),
                this.destinationPath('tsconfig.json'),
                this.ops
            );
            this.fs.copyTpl(
                this.templatePath('ts', 'main.ts'),
                this.destinationPath(this.ops.srcPath, 'main.ts'),
                Object.assign({className}, this.ops)
            );
        }
    }

    install() {
        const packages = [];
        if (this.ops.lang == 'ts') {
            packages.push('typescript', '@turbowarp/types');
        }
        if (this.ops.serverType == 'express') {
            packages.push('express');
        }
        if (this.usesPkgManager) {
            if (this.ops.pkgManager=='npm') {
                this.spawnCommand('npm', ['install', ...packages, '-y', '--quiet', '--save-dev']);
            //} else if (this.ops.pkgManager=='yarn') {
            //    this.spawnCommand('yarn', ['add', ...packages, '--dev']);
            }
        }
        if (this.ops.gitInit) {
            this.spawnCommand('git', ['init', '--quiet', '--initial-branch=main']);
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
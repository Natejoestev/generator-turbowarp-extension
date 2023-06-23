const Generator = require('yeoman-generator');
const path = require('path');

module.exports = class extends Generator {
    constructor(args, opts) {
        super(args, opts);
        this.description = 'Generator for Turbowarp extensions.';
    }
    initializing() {
    }

    async prompting() {
        const {extName} = await this.prompt([
            { name: 'extName', message: 'Extension name:', default:this.appname,
            filter(txt) {
                return txt.replaceAll(' ','');
            } }
        ]);
        this.extName = extName;
        const {extId} = await this.prompt([
            { name: 'extId', message: 'Extension Id:', default:extName.toLowerCase().match(/[a-z0-9]/g).join(''),
            validate(txt) {
                const res = txt.match(/[a-z0-9]/g);
                if (res && res.join('') == txt) return true;
                return `Only a-z and 0-9 (no uppercase letters or special characters)`;
            } }
        ] );
        this.extId = extId;

        const {language} = await this.prompt([
            { name: 'language', type: 'list', choices: [
                { name: 'javascript', value: 'js' },
                { name: 'typescript (node project compiled to js)', value: 'ts' }   
            ] }
        ]);
        this.language = language;
        if (language == 'ts') {
            const {pkgManager} = await this.prompt([
                { name: 'pkgManager', message: 'What package manager to use?', type: 'list', choices: [
                    'npm'
                ]}
            ]);
            this.pkgManager = pkgManager;
            const {srcPath} = await this.prompt([
                { name: 'srcPath', message: 'What path to src files?', default:'src' }
            ]);
            this.srcPath = srcPath;
        }

        const vscodeChoices = [
            { name: 'Launch dev browser', value: 'browser'},
            { name: 'Run dev HTTP server on startup', value: 'httpserver'}
        ];
        if (language == 'ts') vscodeChoices.push({ name: 'Run typescript compiler on startup', value: 'tsc' });
        const {vscodeInit} = await this.prompt([
            { name: 'vscodeInit' , message: 'Initialize vscode dev env?', type:'checkbox', choices: vscodeChoices }
        ]);
        this.vscodeInit = vscodeInit;
        if (vscodeInit.includes('httpserver') || vscodeInit.includes('browser')) {
            const {devPort} = await this.prompt([
                { name: 'devPort' , message: 'Dev Http port:', default: '5010' }
            ]);
            this.devPort = devPort;
        }
    }

    writing() {
        //TODO maybe have tsc and httpserver tasks both add themselves into the array of tasks then write to tasks.json (http- and tsc- *tasks.json would be just the task itself)
        const vscodeTasksPath = this.destinationPath(this.extName, '.vscode', 'tasks.json');
        if (this.vscodeInit.includes('httpserver')) {
            //TODO use better httpserver instead of python
            this.fs.copyTpl(
                this.templatePath('vscode', 'http-tasks.json'),
                vscodeTasksPath,
                { devPort: this.devPort }
            );
        }
        if (this.vscodeInit.includes('browser')) {
            this.fs.copyTpl(
                this.templatePath('vscode', 'browser-launch.json'),
                this.destinationPath(this.extName, '.vscode', 'launch.json'),
                { devPort: this.devPort }
            );
        }
        if (this.vscodeInit.includes('tsc')) {
            if (this.vscodeInit.includes('httpserver')) {
                const content = this.fs.readJSON(vscodeTasksPath);
                content.tasks.push(this.fs.readJSON(this.templatePath('vscode', 'tsc-tasks.json')).tasks[0])
                this.fs.writeJSON(vscodeTasksPath, content, undefined, '    ');
            } else {
                this.fs.copyTpl(
                    this.templatePath('vscode', 'tsc-tasks.json'),
                    vscodeTasksPath,
                    { devPort: this.devPort }
                );
            }
        }
        if (this.language == 'js') {
            this.fs.copyTpl(
                this.templatePath('js', 'extension.js'),
                this.destinationPath(this.extName, 'extension.js'),
                { extName: this.extName, extId: this.extId }
            );
        } else if (this.language == 'ts') {
            if (this.pkgManager == 'npm') {
                this.fs.copyTpl(
                    this.templatePath('ts', 'tsconfig.json'),
                    this.destinationPath(this.extName, 'tsconfig.json'),
                    { srcPath: this.srcPath }
                );
                this.fs.copyTpl(
                    this.templatePath('ts', 'main.ts'),
                    this.destinationPath(this.extName, this.srcPath, 'main.ts'),
                    { extName: this.extName, extId: this.extId }
                );
                this.fs.copyTpl(
                    this.templatePath('ts', 'package.json'),
                    this.destinationPath(this.extName, 'package.json'),
                    { extName: this.extName }
                );
                this.destinationRoot(path.resolve(this.destinationPath(), this.extName));
                this.spawnCommand('npm', ['install', 'typescript', '-y', '--quiet']);
                //TODO add types (@turbowarp/types) on npm
            }
        }
    }
};
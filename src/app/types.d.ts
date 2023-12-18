import Generator, {
    GeneratorOptions as BaseGeneratorOptions
} from 'yeoman-generator';

export interface ExtensionConfig {
    extName?: string,
    extId?: string,
    newFolder?: boolean,
    gitInit?: boolean,
    lang?: 'ts'|'js',
    srcPath?: string,
    devEnv?: {
        typ: 'vscode'|'runcli'|null,
        init?: {
            browser?: true,
            httpserver?: true,
            tsc?: true
        },
        browserType?: string,
        serverType?: string
    },
    expressServer?: boolean,
    devPort?: string,
    pkgManager?: 'npm'
}

export type GeneratorOptions = BaseGeneratorOptions & {
    quick:boolean,
    lang:'js'|'ts',
    git:boolean,
    srcPath:string,
    expressServer:boolean,
    vscode:boolean,
    packageManager:'npm'
}
export type Gen = Generator<GeneratorOptions>;
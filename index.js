const fs = require("fs");
const path = require("path");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const babel = require("@babel/core"); 

// 引入配置文件
const config = require("./webpack.config");

let ID = 0;

function createModuleInfo(filePath) {
    // 读取入口文件的内容
    const fileContent = fs.readFileSync(filePath, "utf-8");

    // 将代码解析为 AST
    const ast = parser.parse(fileContent, {
        sourceType: "module"
    });

    const deps = [];
    traverse(ast, {
        ImportDeclaration: ({ node }) => {
            deps.push(node.source.value);
        }
    });

    const id = ID++;

    // 编译为 ES5
    const { code } = babel.transformFromAstSync(ast, null, {
        presets: ["@babel/preset-env"]
    });

    return {
        id,
        filePath,
        deps,
        code
    };
}

function createDependencyGraph(entry) {
    const entryInfo = createModuleInfo(entry);
    // 项目依赖树
    const graphArr = [];
    graphArr.push(entryInfo);
    for (const module of graphArr) {
        module.map = {};
        module.deps.forEach(depPath => {
            const baseDir = path.dirname(module.filePath);
            let moduleDepPath = `./${path.join(baseDir, depPath).replace(/["\\"]/ig, '/')}.js`;
            const moduleInfo = createModuleInfo(moduleDepPath);
            graphArr.push(moduleInfo);
            module.map[depPath] = moduleInfo.id;
        })
    }

    return graphArr;
}

function pack(graph) {
    const moduleArgArr = graph.map(module => {
        return `${module.id}: {
            factory: (exports, require) => {
                ${module.code}
            },
            map: ${JSON.stringify(module.map)}
        }`
    });

    // 使用 IIFE 的方式，来保证模块变量不会影响到全局作用域
    // 1.通过require(map[requireDeclarationName])方式，按顺序递归调用各个依赖模块；
    // 2.通过调用factory(module.exports, localRequire)执行模块相关代码；
    // 3.该方法最终返回module.exports对象，module.exports 最初值为空对象（{exports: {}}），
    // 但在一次次调用factory()函数后，module.exports对象内容已经包含了模块对外暴露的内容了
    const myBundler = `(function(modules){
        const require = id => {
          const {factory, map} = modules[id];    
          const localRequire = requireDeclarationName => require(map[requireDeclarationName]);    
          const module = {exports: {}};   
          factory(module.exports, localRequire);   
          return module.exports; 
        } 
        require(0);
      })({${moduleArgArr.join()}})
    `;
    return myBundler;
}

const codes = pack(createDependencyGraph(config.entry));
fs.writeFileSync(path.join(config.output.path, config.output.filename), codes);
const fs = require("fs");
const path = require("path");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const t = require("@babel/types");
const generate  = require('@babel/generator').default;
const ejs = require("ejs");

// 引入配置文件
const config = require("./webpack.config");

const ESMODULE_TAG_FUN = `
__webpack_require__.r(__webpack_exports__);\n
`;

const EXPORT_DEFAULT_FUN = `
__webpack_require__.d(__webpack_exports__, {
   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
});\n
`;

function parseFile(file) {
    // 读取入口文件的内容
    const fileContent = fs.readFileSync(file, "utf-8");

    // 将代码解析为 AST
    const ast = parser.parse(fileContent, {
        sourceType: "module"
    });

    // 当前文件的所有依赖
    let dependencies = [];
    // 将原本 import 进来的变量名和当前创建的变量名对于起来
    let fileDependencies = {};
    let hasExport = false;

    // 遍历 AST 上的结点
    traverse(ast, {
        // ImportDeclaration：就是第一行的import定义
        ImportDeclaration(p) {
            const importFile = p.node.source.value;

            // import进来的变量名字
            let importVarName = p.node.specifiers[0].local.name;

            let importFilePath = `./${path.join(path.dirname(config.entry), importFile).replace(/["\\"]/ig, '/')}.js`;
            let importCovertVarName = `__${path.basename(importFile)}__WEBPACK_IMPORTED_MODULE_0__`;
            fileDependencies[importVarName] = importCovertVarName;

            dependencies.push(importFilePath);
            // 构建一个变量定义的AST节点
            const variableDeclaration = t.variableDeclaration("const", [
                t.variableDeclarator(
                t.identifier(importCovertVarName),
                t.callExpression(t.identifier("__webpack_require__"), [
                    t.stringLiteral(importFilePath),
                ])
                ),
            ]);
        
            // 将当前节点替换为变量定义节点
            p.replaceWith(variableDeclaration);
        },
        CallExpression(p) {
            if (fileDependencies[p.node.name]) {
                p.node.callee.name = `${fileDependencies[p.node.name]}.default`;
            }
        },
        Identifier(p) {
          // 如果调用的是import进来的变量
          if (fileDependencies[p.node.name]) {
            // 就将它替换为转换后的变量名字
            p.node.name = `${fileDependencies[p.node.name]}.default`;
          }
        },
        ExportDefaultDeclaration(p) {
          hasExport = true; // 先标记是否有export
    
          // 跟前面import类似的，创建一个变量定义节点
          const variableDeclaration = t.variableDeclaration("const", [
            t.variableDeclarator(
              t.identifier("__WEBPACK_DEFAULT_EXPORT__"),
              t.identifier(p.node.declaration.name)
            ),
          ]);
    
          // 将当前节点替换为变量定义节点
          p.replaceWith(variableDeclaration);
        },
    })

    let newCode = generate(ast).code;

    if (hasExport) {
      newCode = `${EXPORT_DEFAULT_FUN} ${newCode}`;
      // 下面添加模块标记代码
      newCode = `${ESMODULE_TAG_FUN} ${newCode}`;
    }
    
    // 返回一个包含必要信息的新对象
    return {
        file,
        dependencies,
        code: newCode,
    };
}

function parseFiles(entryFile) {
    const entryRes = parseFile(entryFile); // 解析入口文件
    const results = [entryRes]; // 将解析结果放入一个数组
  
    // 循环结果数组，将它的依赖全部拿出来解析
    for (const res of results) {
      const dependencies = res.dependencies;
      dependencies.map((dependency) => {
        if (dependency) {
          const ast = parseFile(dependency);
          results.push(ast);
        }
      });
    }
  
    return results;
}

const allAst = parseFiles(config.entry);

// 使用ejs将上面解析好的ast传递给模板
// 返回最终生成的代码
function generateCode(allAst, entry) {
  const temlateFile = fs.readFileSync(
    path.join(__dirname, "./template.js"),
    "utf-8"
  );

  const codes = ejs.render(temlateFile, {
    __TO_REPLACE_WEBPACK_MODULES__: allAst,
    __TO_REPLACE_WEBPACK_ENTRY__: entry,
  });

  return codes;
}

const codes = generateCode(allAst, config.entry);
fs.writeFileSync(path.join(config.output.path, config.output.filename), codes);
下面的几篇文章读完都受益匪浅
1. [ 解析 Webpack 源码，实现自己的构建工具](https://kaiwu.lagou.com/course/courseInfo.htm?courseId=584#/detail/pc?id=5919)  
2. [实现一个简易的webpack](https://segmentfault.com/a/1190000015225750)  
3. [手写一个webpack，看看AST怎么用](https://mp.weixin.qq.com/s?__biz=MzI2NjAzNDgxMA==&mid=2247484025&idx=1&sn=01dcace5b04459231c5ade887a8589f6&chksm=ea95096cdde2807a9e28b39b69c91d7c9919064c2d0d1897d3dc72b6153b4896752e20570184&scene=178&cur_album_id=1680274257139777545#rd)  

# Webpack 的打包实现
最重要的部分应该算是 **依赖解析**  
1. 读取入口文件
2. 利用 babel 将代码解析为 AST，产出依赖列表，将代码转为 ES5
3. 将转换后的依赖存储到一个对象中进行管理，构建出一个依赖图（Dependency Graph）
4. 将各模块内容 bundle 产出  

然后基于 IIFE 、闭包等手段保证了模块变量不会影响到全局作用域
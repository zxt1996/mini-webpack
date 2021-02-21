import hello from './hello';
import one from './one';

console.log(one);
console.log(hello);

const world = "world";

const helloWorld = () => `${hello} ${world}`;

export default helloWorld;
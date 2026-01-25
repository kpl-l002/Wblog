// 导入必要的模块
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';  // 确保只导入一次fs模块


// 如果原代码中还有其他地方再次声明了fs，应删除重复声明
// 例如删除类似下面的重复代码：
// const fs = require('fs');  // 删除这行如果存在的话

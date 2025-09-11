/** biome-ignore-all lint: test */
import { bench, describe } from 'vitest';

type BenchOption = Required<Parameters<typeof bench>>[2];

const baseBenchOption: BenchOption = {
  warmupTime: 0,
  warmupIterations: 0,
};

const selfBench: (...args: Parameters<typeof bench>) => ReturnType<typeof bench> = (name, fn, option) => {
  bench(name, fn, { ...baseBenchOption, ...option });
};

/**
 * 多条件分支的情况下尽量使用下面的代码规范
 *
 * 对于大概率的的分支判断, 统一使用 if 语句
 * 例如下面的测试中 1 的占比约为 80%, 所以 1 的判断先使用 if 语句处理
 * 其余可预测条件使用 switch 语句处理
 *
 *
 * 使用 switch 注意事项
 *
 * 使用 switch 时优先使用连续整数, 然后是不连续有序整数
 * 保证 case 表达式类型稳定
 * 如果 case 类型不为数值的话会被降级为 if-else 要保证高频 case 在前面
 * 大量 case 的情况下优先使用对象 kv 的形式
 */
describe('switch 和 if 的性能测试', () => {
  const numberArr = Array.from({ length: 10_000_000 }, () => {
    return Math.random() < 0.8 ? 1 : Math.floor(Math.random() * 10 + 1);
  });

  // 字符串状态数组 - 模拟真实业务场景
  const statusArr = Array.from({ length: 10_000_000 }, () => {
    const rand = Math.random();
    if (rand < 0.4) return 'pending';     // 40% 高频状态
    if (rand < 0.6) return 'uploading';   // 20%
    if (rand < 0.75) return 'finished';   // 15%
    if (rand < 0.9) return 'success';     // 15%
    return 'failed';                      // 10%
  });

  const forEach = <T>(arr: T[], callback: (item: T, idx: number) => void) => {
    const length = arr.length;
    for (let i = 0; i < length; ++i) {
      callback(arr[i], i);
    }
  };

  selfBench('forEach 基础性能测试', () => {
    forEach(numberArr, () => {});
  });

  selfBench('全 switch', () => {
    const getValue = (item: number) => {
      switch (item) {
        case 1:
          return String(item);
        case 2:
          return String(item);
        case 3:
          return String(item);
        case 4:
          return String(item);
        case 5:
          return String(item);
        case 6:
          return String(item);
        case 7:
          return String(item);
        case 8:
          return String(item);
        case 9:
          return String(item);
        case 10:
          return String(item);
        default:
          return 'other';
      }
    };
    forEach(numberArr, getValue);
  });

  selfBench('全 if', () => {
    const getValue = (item: number) => {
      if (item === 1) {
        return String(item);
      }
      if (item === 2) {
        return String(item);
      }
      if (item === 3) {
        return String(item);
      }
      if (item === 4) {
        return String(item);
      }
      if (item === 5) {
        return String(item);
      }
      if (item === 6) {
        return String(item);
      }
      if (item === 7) {
        return String(item);
      }
      if (item === 8) {
        return String(item);
      }
      if (item === 9) {
        return String(item);
      }
      if (item === 10) {
        return String(item);
      }
      return 'other';
    };
    forEach(numberArr, getValue);
  });

  selfBench('if switch 混合', () => {
    const getValue = (item: number) => {
      if (item === 1) {
        return String(item);
      }
      switch (item) {
        case 2:
          return String(item);
        case 3:
          return String(item);
        case 4:
          return String(item);
        case 5:
          return String(item);
        case 6:
          return String(item);
        case 7:
          return String(item);
        case 8:
          return String(item);
        case 9:
          return String(item);
        case 10:
          return String(item);
        default:
          return 'other';
      }
    };
    forEach(numberArr, getValue);
  });

  selfBench('不连续分支全 switch', () => {
    const getValue = (item: number) => {
      switch (item) {
        case 1:
          return String(item);
        case 2:
          return String(item);
        case 6:
          return String(item);
        case 7:
          return String(item);
        default:
          return 'other';
      }
    };
    forEach(numberArr, getValue);
  });

  selfBench('不连续分支全 if', () => {
    const getValue = (item: number) => {
      if (item === 1) {
        return String(item);
      }
      if (item === 2) {
        return String(item);
      }
      if (item === 6) {
        return String(item);
      }
      if (item === 7) {
        return String(item);
      }
      return 'other';
    };
    forEach(numberArr, getValue);
  });

  selfBench('不连续分支 if switch 混合', () => {
    const getValue = (item: number) => {
      if (item === 1) {
        return String(item);
      }
      switch (item) {
        case 2:
          return String(item);
        case 6:
          return String(item);
        case 7:
          return String(item);
        default:
          return 'other';
      }
    };
    forEach(numberArr, getValue);
  });

  selfBench('不连续无序分支全 switch', () => {
    const getValue = (item: number) => {
      switch (item) {
        case 2:
          return String(item);
        case 1:
          return String(item);
        case 7:
          return String(item);
        case 6:
          return String(item);
        default:
          return 'other';
      }
    };
    forEach(numberArr, getValue);
  });

  selfBench('不连续无序分支全 if', () => {
    const getValue = (item: number) => {
      if (item === 2) {
        return String(item);
      }
      if (item === 1) {
        return String(item);
      }
      if (item === 7) {
        return String(item);
      }
      if (item === 6) {
        return String(item);
      }
      return 'other';
    };
    forEach(numberArr, getValue);
  });

  selfBench('不连续无序分支 if switch 混合', () => {
    const getValue = (item: number) => {
      if (item === 1) {
        return String(item);
      }
      switch (item) {
        case 7:
          return String(item);
        case 2:
          return String(item);
        case 6:
          return String(item);
        default:
          return 'other';
      }
    };
    forEach(numberArr, getValue);
  });

  // 新增 if else if 测试
  selfBench('连续分支 if else if', () => {
    const getValue = (item: number) => {
      if (item === 1) {
        return String(item);
      } else if (item === 2) {
        return String(item);
      } else if (item === 3) {
        return String(item);
      } else if (item === 4) {
        return String(item);
      } else if (item === 5) {
        return String(item);
      } else if (item === 6) {
        return String(item);
      } else if (item === 7) {
        return String(item);
      } else if (item === 8) {
        return String(item);
      } else if (item === 9) {
        return String(item);
      } else if (item === 10) {
        return String(item);
      } else {
        return 'other';
      }
    };
    forEach(numberArr, getValue);
  });

  selfBench('不连续分支 if else if', () => {
    const getValue = (item: number) => {
      if (item === 1) {
        return String(item);
      } else if (item === 2) {
        return String(item);
      } else if (item === 6) {
        return String(item);
      } else if (item === 7) {
        return String(item);
      } else {
        return 'other';
      }
    };
    forEach(numberArr, getValue);
  });

  selfBench('不连续无序分支 if else if', () => {
    const getValue = (item: number) => {
      if (item === 2) {
        return String(item);
      } else if (item === 1) {
        return String(item);
      } else if (item === 7) {
        return String(item);
      } else if (item === 6) {
        return String(item);
      } else {
        return 'other';
      }
    };
    forEach(numberArr, getValue);
  });

  selfBench('高频优先 if else if', () => {
    const getValue = (item: number) => {
      if (item === 1) {  // 80% 概率
        return String(item);
      } else if (item === 2) {
        return String(item);
      } else if (item === 3) {
        return String(item);
      } else if (item === 4) {
        return String(item);
      } else if (item === 5) {
        return String(item);
      } else if (item === 6) {
        return String(item);
      } else if (item === 7) {
        return String(item);
      } else if (item === 8) {
        return String(item);
      } else if (item === 9) {
        return String(item);
      } else if (item === 10) {
        return String(item);
      } else {
        return 'other';
      }
    };
    forEach(numberArr, getValue);
  });
});

// 字符串状态性能测试
describe('字符串状态判断性能测试', () => {
  const statusArr = Array.from({ length: 10_000_000 }, () => {
    const rand = Math.random();
    if (rand < 0.4) return 'pending';     // 40% 高频状态
    if (rand < 0.6) return 'uploading';   // 20%
    if (rand < 0.75) return 'finished';   // 15%
    if (rand < 0.9) return 'success';     // 15%
    return 'failed';                      // 10%
  });

  const forEach = <T>(arr: T[], callback: (item: T, idx: number) => void) => {
    const length = arr.length;
    for (let i = 0; i < length; ++i) {
      callback(arr[i], i);
    }
  };

  selfBench('字符串状态 switch', () => {
    const getStatusMessage = (status: string) => {
      switch (status) {
        case 'pending':
          return '等待中';
        case 'uploading':
          return '上传中';
        case 'finished':
          return '已完成';
        case 'success':
          return '成功';
        case 'failed':
          return '失败';
        default:
          return '未知状态';
      }
    };
    forEach(statusArr, getStatusMessage);
  });

  selfBench('字符串状态 if else if', () => {
    const getStatusMessage = (status: string) => {
      if (status === 'pending') {
        return '等待中';
      } else if (status === 'uploading') {
        return '上传中';
      } else if (status === 'finished') {
        return '已完成';
      } else if (status === 'success') {
        return '成功';
      } else if (status === 'failed') {
        return '失败';
      } else {
        return '未知状态';
      }
    };
    forEach(statusArr, getStatusMessage);
  });

  selfBench('字符串状态 高频优先 if else if', () => {
    const getStatusMessage = (status: string) => {
      if (status === 'pending') {    // 40% 概率
        return '等待中';
      } else if (status === 'uploading') {  // 20%
        return '上传中';
      } else if (status === 'finished') {   // 15%
        return '已完成';
      } else if (status === 'success') {    // 15%
        return '成功';
      } else if (status === 'failed') {     // 10%
        return '失败';
      } else {
        return '未知状态';
      }
    };
    forEach(statusArr, getStatusMessage);
  });

  selfBench('字符串状态 独立 if', () => {
    const getStatusMessage = (status: string) => {
      if (status === 'pending') {
        return '等待中';
      }
      if (status === 'uploading') {
        return '上传中';
      }
      if (status === 'finished') {
        return '已完成';
      }
      if (status === 'success') {
        return '成功';
      }
      if (status === 'failed') {
        return '失败';
      }
      return '未知状态';
    };
    forEach(statusArr, getStatusMessage);
  });

  selfBench('字符串状态 对象映射', () => {
    const statusMap = {
      pending: '等待中',
      uploading: '上传中',
      finished: '已完成',
      success: '成功',
      failed: '失败'
    } as const;

    const getStatusMessage = (status: string) => {
      return statusMap[status as keyof typeof statusMap] || '未知状态';
    };
    forEach(statusArr, getStatusMessage);
  });

  selfBench('字符串状态 Map 对象', () => {
    const statusMap = new Map([
      ['pending', '等待中'],
      ['uploading', '上传中'],
      ['finished', '已完成'],
      ['success', '成功'],
      ['failed', '失败']
    ]);

    const getStatusMessage = (status: string) => {
      return statusMap.get(status) || '未知状态';
    };
    forEach(statusArr, getStatusMessage);
  });
});

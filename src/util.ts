// 如果结合防抖会导致move被延时计算，导致moveend之后又调用了move，感觉不是很有必要，干脆直接不要了
export function throttle(fn: (...args: any[]) => void, time: number) {
  let pre = 0
  // let timer: number | undefined
  return function (...args: any[]) {
    if (Date.now() - pre > time) {
      // clearTimeout(timer)
      // timer = void 0;
      pre = Date.now()
      fn(...args)
    } 
    // else if (!timer) {
    //   let resolve: (value?: unknown) => void
    //   const promise = new Promise(r => { resolve = r })
    //   timer = setTimeout(() => {
    //     fn(...args)
    //     resolve()
    //   }, time);
    //   return promise
    // }
  }
}

export function idGen() {
  let id = 0
  return function newId() {
    return id++
  }
}

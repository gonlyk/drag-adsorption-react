import { Component, createRef, FC, RefObject, ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { throttle } from './util'
import './style/index.css'

type Point = { x: number, y: number }
type Rect = { w: number, h: number } & Partial<Point>
export type Data = {
    key: string | number,
    width?: string,
    content: FC<{ item: Data }>,
    _dom: HTMLDivElement,
    _origin?: Point,
    _offsetParent?: Point,
    _custom: Object
}
type Direction = 'row' | 'column'
type Option = {
    initData: Pick<Data, 'key' | 'width' | 'content'>[] & { [k in string]: any },
    direction?: Direction
    lockAxis?: boolean
    dragBlockClass?: string
    onChange?: (data: ({ key: string | number } & { [k in string]: any })[]) => void
}

const classPrefix = 'drap-adorption_'

class ContentWraper extends Component<{ content: ReactNode, afterMount: Function }> {
    componentDidMount(): void {
        this.props.afterMount()
    }
    render(): ReactNode {
        return <>{this.props.content}</>
    }
}

export class DrapAdsorption extends Component<Option> {
    private option: Option
    private container: RefObject<HTMLDivElement>
    private data: Data[]
    private newData: Data[]
    private direction: Direction
    private movingItem?: Data
    private movingItemIndex: number = -1
    private movingTranslate: Point = { x: 0, y: 0 }
    private lockAxis: boolean
    private dragBlockClass: string

    // 判断移动的基准点
    private movingCenter: Point = { x: 0, y: 0 }
    private wrapperRect: Rect = { w: 0, h: 0 }
    private itemsRect: Required<Rect>[] = []

    constructor(option: Option) {
        super(option)
        this.option = option

        this.data = option.initData.map(item => {
            let it = {
                key: item.key,
                content: item.content,
                width: item.width,
                _custom: {}
            }

            for (let p in item) {
                if (p.startsWith('_')) {
                    console.error('keyword conflict')
                } else if (p === 'key' || p === 'content' || p === 'width' || p === 'onChange') {
                    continue
                } else {
                    // @ts-ignore
                    it._custom[p] = item[p]
                }
            }
            return it as Data
        })
        this.newData = this.data
        this.direction = option.direction || 'column'
        this.lockAxis = option.lockAxis || false
        this.dragBlockClass = option.dragBlockClass || ''

        let container = document.createElement('div')
        container.style.display = 'flex'
        container.style.flexDirection = this.direction
        container.style.position = 'relative'

        this.container = createRef()

        this.checkSort = throttle(this.checkSort.bind(this), 100)
    }

    componentDidMount(): void {
        for (let item of this.data) {
            this.add(item)
        }
        // 鼠标快速移动会使div失去move事件
        window.addEventListener('mousemove', e => this.movingItem && this.dragMove(e, this.movingItem, this.movingItem?._dom))
        window.addEventListener('mouseup', e => this.movingItem && this.dragEnd(e, this.movingItem, this.movingItem?._dom))
    }

    private dragStart(e: MouseEvent, item: Data, div: HTMLDivElement) {
        e.stopPropagation()
        this.movingItem = item
        this.movingItemIndex = this.data.indexOf(item)
        item._origin = { x: e.clientX, y: e.clientY }
        item._offsetParent = { x: div.offsetLeft, y: div.offsetTop }
        div.classList.add('moving')
        // 获取开始拖拽时item和wrapper的dom状态
        this.wrapperRect.h = this.container.current!.clientHeight
        this.wrapperRect.w = this.container.current!.clientWidth
        this.movingCenter.x = div.offsetLeft + div.clientWidth / 2
        this.movingCenter.y = div.offsetHeight + div.clientHeight / 2

        this.itemsRect = []
        for (let item of this.data) {
            this.itemsRect.push({
                x: item._dom.offsetLeft,
                y: item._dom.offsetTop,
                w: item._dom.clientWidth,
                h: item._dom.clientHeight
            })
        }
    }

    private dragMove(e: MouseEvent, item: Data, div?: HTMLDivElement) {
        e.stopPropagation()
        if (!item || !item._origin || !div) {
            return
        }
        this.movingTranslate.x = e.clientX - item._origin.x
        this.movingTranslate.y = e.clientY - item._origin.y
        if (this.lockAxis && this.direction === 'row') {
            this.movingTranslate.y = 0
        } else if (this.lockAxis && this.direction === 'column') {
            this.movingTranslate.x = 0
        }
        div.style.transform = `translate(${this.movingTranslate.x}px, ${this.movingTranslate.y}px)`

        // 重新计算排序
        // movingCenter移动
        this.movingCenter.x += e.clientX - this.movingCenter.x
        this.movingCenter.y += e.clientY - this.movingCenter.y

        this.checkSort()
    }

    private dragEnd(e: MouseEvent, item: Data, div?: HTMLDivElement) {
        e.stopPropagation()
        if (!div) {
            return
        }

        // 进入静态移动，避免多余动画， 移动物体使用style设置translate不受影响
        for (let item of this.data) {
            item._dom.classList.add('reseting')
        }

        this.patch(this.container.current!, this.newData, this.data)
        // 计算一下新的translate
        const newIndex = this.newData.findIndex(item => item.key === this.movingItem?.key)
        let offsetX = 0, offsetY = 0
        if (this.movingItemIndex < newIndex) {
            // 0 -> 1 需要减去原来的1
            for (let i = this.movingItemIndex + 1; i <= newIndex; i++) {
                if (this.direction === 'row') {
                    offsetX -= this.itemsRect[i].w
                } else {
                    offsetY -= this.itemsRect[i].h
                }
            }
        } else if (this.movingItemIndex > newIndex) {
            // 1 -> 0 需要加上原来的0
            for (let i = newIndex; i < this.movingItemIndex; i++) {
                if (this.direction === 'row') {
                    offsetX += this.itemsRect[i].w
                } else {
                    offsetY += this.itemsRect[i].h
                }
            }
        }
        div.style.transform = `translate(${this.movingTranslate.x + offsetX}px, ${this.movingTranslate.y + offsetY}px)`
        this.data = this.newData
        this.props.onChange?.(this.getData())

        this.resetStyle()
        item._origin = void 0
        this.movingItem = void 0
        this.movingItemIndex = -1
        setTimeout(() => {
            div.classList.remove('moving')
            div.style.transform = ``
            for (let item of this.data) {
                item._dom.classList.remove('reseting')
            }
        })
    }

    private add(item: Data) {
        const div = document.createElement('div')
        div.classList.add(`${classPrefix}drag-item`)
        div.dataset.id = item.key + ''
        if (item.width && this.direction === 'row') {
            div.style.width = item.width
        }
        const root = createRoot(div)
        const Content = item.content
        root.render(<ContentWraper content={<Content item={item} />}
            afterMount={() => {
                let dragBlock: HTMLElement | null
                if (this.dragBlockClass) {
                    try {
                        dragBlock = div.querySelector(`.${this.dragBlockClass}`)
                    } catch (e) {
                        console.error(e)
                    }
                }
                // @ts-ignore ts(2454)
                if (!dragBlock) {
                    dragBlock = div
                }
                dragBlock.addEventListener('mousedown', e => this.dragStart(e as MouseEvent, item, item._dom as HTMLDivElement))
            }}
        />)
        item._dom = div
        this.container.current!.appendChild(div)
    }

    private resetStyle() {
        for (let item of this.data) {
            if (item === this.movingItem) continue

            item._dom && (item._dom.style.transform = '')
        }
    }

    private checkSort() {
        // reset transform
        this.resetStyle()

        const replace = (n: number, o: number) => {
            let newData = [...this.data]
            const item = newData[o]
            newData = newData.slice(0, o).concat(newData.slice(o + 1))
            newData = newData.slice(0, n).concat(item).concat(newData.slice(n))
            this.newData = newData
        }

        let replaceIndex = -1
        if (this.direction === 'row') {
            for (let i = 0; i < this.itemsRect.length; i++) {
                const item = this.itemsRect[i]
                if (i < this.movingItemIndex && this.movingCenter.x < item.x + item.w / 2) {
                    // 如果移动到前面的，第一个匹配的就是最终结果
                    ; (replaceIndex < 0) && (replaceIndex = i)
                    this.data![i]!._dom.style.transform = `translateX(${this.itemsRect[this.movingItemIndex].w}px)`
                } else if (i > this.movingItemIndex && this.movingCenter.x > item.x + item.w / 2) {
                    replaceIndex = i
                    this.data![i]!._dom.style.transform = `translateX(-${this.itemsRect[this.movingItemIndex].w}px)`
                }
            }

        } else {
            for (let i = 0; i < this.itemsRect.length; i++) {
                const item = this.itemsRect[i]
                if (i < this.movingItemIndex && this.movingCenter.y < item.y + item.h / 2) {
                    // 如果移动到前面的，第一个匹配的就是最终结果
                    ; (replaceIndex < 0) && (replaceIndex = i)
                    this.data[i]._dom.style.transform = `translateY(${this.itemsRect[this.movingItemIndex].h}px)`
                } else if (i > this.movingItemIndex && this.movingCenter.y > item.y + item.h / 2) {
                    replaceIndex = i
                    this.data[i]._dom.style.transform = `translateY(-${this.itemsRect[this.movingItemIndex].h}px)`
                }
            }
        }
        if (replaceIndex > -1) {
            replace(replaceIndex, this.movingItemIndex)
        } else {
            // 因为每次都是基于拖拽前状态计算的，但是newData会一直变化，如果先改变顺序在拖回来不会触发replace，直接恢复到原始data
            this.newData = this.data
        }
    }

    private patch(container: HTMLDivElement, newData: Data[], oldData: Data[]) {
        let i
        for (i = 0; i < newData.length; i++) {
            const newItem = newData[i]
            const oldItem = oldData[i]
            if (!oldItem) {
                container.appendChild(newItem._dom)
                continue
            }

            if (newItem.key !== oldItem.key) {
                let finded, j
                for (j = i + 1; j < oldData.length; j++) {
                    if (oldData[j].key === newItem.key) {
                        finded = oldData[j]
                        oldData = oldData.slice(0, j).concat(oldData.slice(j + 1))
                        oldData = oldData.slice(0, i).concat(finded).concat(oldData.slice(i))
                        break
                    }
                }
                if (finded) {
                    container.insertBefore(finded._dom, oldData[i + 1]._dom)
                } else {
                    container.removeChild(oldData[i]._dom)
                }
            }
        }

        for (let index = i; index < oldData.length; index++) {
            container.removeChild(oldData[index]._dom)
        }
    }

    getContainer() {
        return this.container.current
    }

    getData(): ({ key: string | number } & { [k in string]: any })[] {
        return this.data.map(item => ({
            key: item.key,
            ...item._custom
        }))
    }

    append(item: Pick<Data, 'width' | 'content'>) {
        const i = { ...item } as Data
        this.data.push(i)
        this.add(i)
        this.props.onChange?.(this.getData())
    }

    remove(id: number) {
        if (this.movingItem) {
            return
        }
        this.newData = this.data.filter(item => item.key !== id)
        this.patch(this.container.current!, this.newData, this.data)
        this.data = this.newData
        this.props.onChange?.(this.getData())
    }

    render() {
        return <div ref={this.container}></div>
    }
}

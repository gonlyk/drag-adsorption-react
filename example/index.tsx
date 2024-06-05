import { createRoot } from 'react-dom/client';
import { DrapAdsorption, Data } from '../dist/index.js'


const content = (c: string, len: number) => ({ item }: { item: Data }) => (
    <div style={{ border: '1px solid black', margin: '5px', height: `${50 * len}px`, display: 'flex', background: 'white' }}>
        <div style={{ width: '20px', flex: 1 }}>{c}</div>
        <div className="drag-block" style={{ width: '20px', height: `${50 * len - 10}px`, margin: '5px', border: '1px solid red' }}></div>
    </div>)

const root = createRoot(document.querySelector('#root') as HTMLDivElement);
root.render(<DrapAdsorption initData={[
    { content: content('网页', 1), key: '网页' },
    { content: content('新闻', 2), key: '新闻' },
    { content: content('图片', 3), key: '图片' },
    { content: content('百科', 4), key: '百科' },
]} onChange={(data) => {
    console.log(data)
}} dragBlockClass="drag-block" lockAxis={true} />)
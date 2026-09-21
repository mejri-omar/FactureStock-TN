export default function TableScroll({ children, className = '' }) {
  return <div className={`table-scroll ${className}`.trim()}>{children}</div>;
}

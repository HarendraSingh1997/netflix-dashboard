import { FileData } from '../components/Explorer'
import { prettyName, slugToFile } from '../lib/files'

export default function FileView({ slug }: { slug: string }) {
  const name = slugToFile(slug)
  if (!name) return <p className="py-10 font-body text-base text-subtle">Unknown file.</p>
  return (
    <div className="space-y-10">
      <div className="space-y-4">
        <h1 className="page-title">{prettyName(name)}</h1>
        <p className="font-body text-lg text-body">
          {name} — every record, searchable, sortable, filterable. Tables virtualize, so scrolling stays smooth.
        </p>
      </div>
      <FileData key={name} name={name} />
    </div>
  )
}

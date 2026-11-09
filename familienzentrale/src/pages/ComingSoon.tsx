import { PageTitle } from '../components/AppShell'
import { Card } from '../components/ui'

export function ComingSoon({ title, text }: { title: string; text: string }) {
  return (
    <>
      <PageTitle>{title}</PageTitle>
      <Card>
        <p className="text-muted">{text}</p>
      </Card>
    </>
  )
}

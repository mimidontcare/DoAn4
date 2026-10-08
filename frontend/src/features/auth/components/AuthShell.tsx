import { Sparkles } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

interface AuthShellProps {
  title: string
  description?: ReactNode
  children: ReactNode
  footer?: ReactNode
}

/** Khung chung cho các trang đăng nhập, đăng ký, đổi mật khẩu. */
export function AuthShell({ title, description, children, footer }: AuthShellProps) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 py-10">
      <Link
        to="/"
        className="flex items-center gap-2 rounded-md text-lg font-semibold text-primary outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <Sparkles aria-hidden="true" className="size-6" />
        Vệ sinh tại nhà
      </Link>
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>
            <h1 className="text-2xl font-semibold">{title}</h1>
          </CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent>{children}</CardContent>
        {footer && (
          <CardFooter className="justify-center text-sm text-muted-foreground">
            {footer}
          </CardFooter>
        )}
      </Card>
    </main>
  )
}

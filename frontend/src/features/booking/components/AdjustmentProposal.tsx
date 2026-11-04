import { UNIT_LABEL } from '@/features/catalog/units'
import { formatVnd } from '@/lib/format'
import type { Proposal } from '../types'

interface AdjustmentProposalProps {
  proposal: Proposal
  currentTotal: number
  /** Nút xác nhận; không truyền thì chỉ hiển thị (vd phía nhân viên). */
  actions?: React.ReactNode
}

/** A03: so sánh khối lượng đã đặt và khối lượng trưởng nhóm đề xuất. */
export function AdjustmentProposal({ proposal, currentTotal, actions }: AdjustmentProposalProps) {
  return (
    <section
      aria-labelledby="proposal-heading"
      className="grid gap-3 rounded-xl border-2 border-primary bg-card p-4"
    >
      <div className="grid gap-1">
        <h2 id="proposal-heading" className="text-lg font-semibold">
          Đề xuất điều chỉnh khối lượng
        </h2>
        <p className="text-sm text-muted-foreground">
          Trưởng nhóm đã kiểm tra thực tế và đề xuất khối lượng mới. Từ chối thì nhân viên chỉ làm
          khối lượng đã đặt.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b">
            <tr>
              <th scope="col" className="py-2 font-semibold">
                Hạng mục
              </th>
              <th scope="col" className="py-2 text-right font-semibold">
                Đã đặt
              </th>
              <th scope="col" className="py-2 text-right font-semibold">
                Đề xuất
              </th>
              {/* Ẩn trên mobile để bảng không tràn; tổng mới vẫn hiện bên dưới. */}
              <th scope="col" className="hidden py-2 text-right font-semibold sm:table-cell">
                Thành tiền
              </th>
            </tr>
          </thead>
          <tbody>
            {proposal.lines.map((line) => (
              <tr key={line.serviceItemId} className="border-b last:border-0">
                <td className="py-2">{line.name}</td>
                <td className="py-2 text-right whitespace-nowrap">
                  {line.quantity} {UNIT_LABEL[line.unit]}
                </td>
                <td
                  className={`py-2 text-right whitespace-nowrap ${line.proposedQuantity !== line.quantity ? 'font-semibold text-primary' : ''}`}
                >
                  {line.proposedQuantity} {UNIT_LABEL[line.unit]}
                </td>
                <td className="hidden py-2 text-right whitespace-nowrap sm:table-cell">
                  {formatVnd(line.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {proposal.subtotal > proposal.itemsTotal && (
        <p className="text-sm text-muted-foreground">
          Áp dụng mức tối thiểu: {formatVnd(proposal.subtotal)}
        </p>
      )}
      <p className="flex flex-wrap justify-between gap-2 border-t pt-2">
        <span>
          Tổng hiện tại <span className="font-semibold">{formatVnd(currentTotal)}</span>
        </span>
        <span className="text-lg font-semibold">
          Tổng mới <span className="text-primary">{formatVnd(proposal.total)}</span>
        </span>
      </p>
      {actions && (
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">{actions}</div>
      )}
    </section>
  )
}

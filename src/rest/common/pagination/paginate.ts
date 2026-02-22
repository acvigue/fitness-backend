import type { PaginationParams } from './pagination.schema';
import type { PaginationMetaDto } from './pagination-response.dto';

export type PaginatedResult<T> = {
  data: T[];
  meta: PaginationMetaDto;
};

export async function paginate<T>(
  params: PaginationParams,
  countFn: () => Promise<number>,
  findFn: (args: { skip: number; take: number }) => Promise<T[]>
): Promise<PaginatedResult<T>> {
  const { page, per_page } = params;
  const skip = (page - 1) * per_page;

  const [total, data] = await Promise.all([countFn(), findFn({ skip, take: per_page })]);

  return {
    data,
    meta: {
      page,
      per_page,
      total,
      total_pages: Math.ceil(total / per_page) || 1,
    },
  };
}

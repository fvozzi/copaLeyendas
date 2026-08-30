import { Controller, Get, Param, Query } from '@nestjs/common';
import { QueryPostsDto } from './dto/query-posts.dto';
import { PostsService } from './posts.service';

@Controller('public/posts')
export class PublicPostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get()
  list(@Query() query: QueryPostsDto) {
    return this.postsService.list(query, { publicOnly: true });
  }

  @Get(':slug')
  getBySlug(@Param('slug') slug: string) {
    return this.postsService.getPublicBySlug(slug);
  }
}

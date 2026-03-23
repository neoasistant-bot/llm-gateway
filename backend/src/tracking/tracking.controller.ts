import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { TrackingService } from './tracking.service';
import { QueryUsageDto } from './dto/query-usage.dto';

@Controller('tracking')
export class TrackingController {
  constructor(private trackingService: TrackingService) {}

  @Get('usage')
  @UseGuards(JwtAuthGuard)
  async getUsage(
    @Query() query: QueryUsageDto,
    @CurrentUser() user: any,
  ) {
    return this.trackingService.getUsage(query, user.sub, user.role);
  }
}

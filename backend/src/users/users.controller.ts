import {
  Controller,
  Get,
  Patch,
  Param,
  Body,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateRateLimitDto } from './dto/update-rate-limit.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Patch(':id/rate-limit')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @UsePipes(new ValidationPipe({ whitelist: true }))
  async updateRateLimit(
    @Param('id') id: string,
    @Body() dto: UpdateRateLimitDto,
  ) {
    return this.usersService.updateRateLimit(id, dto);
  }

  @Get(':id/rate-limit')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async getRateLimit(@Param('id') id: string) {
    return this.usersService.getRateLimit(id);
  }
}

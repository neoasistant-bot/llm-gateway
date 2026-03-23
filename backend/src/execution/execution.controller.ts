import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ClientRateLimitGuard } from '../common/guards/rate-limit.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { ExecutionService } from './execution.service';
import { ExecuteMethodDto } from './dto/execute-method.dto';
import { QueryExecutionsDto } from './dto/query-executions.dto';

@Controller('execution')
export class ExecutionController {
  constructor(private executionService: ExecutionService) {}

  @Post(':methodId')
  @HttpCode(200)
  @UseGuards(JwtAuthGuard, ClientRateLimitGuard)
  async executeMethod(
    @Param('methodId') methodId: string,
    @Body() body: ExecuteMethodDto,
    @CurrentUser() user: any,
  ) {
    const ip = user?.ip || 'unknown';

    if (body.async) {
      return this.executionService.executeAsync(user.sub, methodId, body.input, ip);
    } else {
      return this.executionService.executeSync(user.sub, methodId, body.input, ip);
    }
  }

  @Get('executions')
  @UseGuards(JwtAuthGuard)
  async getExecutions(
    @Query() query: QueryExecutionsDto,
    @CurrentUser() user: any,
  ) {
    return this.executionService.findAll(query, user.sub, user.role);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async getExecution(
    @Param('id') id: string,
    @CurrentUser() user: any,
  ) {
    return this.executionService.findOne(id, user.sub, user.role);
  }
}

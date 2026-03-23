import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import { MethodsService } from './methods.service';
import { CreateMethodDto } from './dto/create-method.dto';
import { UpdateMethodDto } from './dto/update-method.dto';
import { QueryMethodsDto } from './dto/query-methods.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('methods')
export class MethodsController {
  constructor(private methodsService: MethodsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async create(@Body() dto: CreateMethodDto) {
    return this.methodsService.create(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async findAll(@Query() query: QueryMethodsDto, @CurrentUser() user: any) {
    return this.methodsService.findAll(query, user.role, user.sub);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard)
  async findOne(@Param('id') id: string, @CurrentUser() user: any) {
    return this.methodsService.findOne(id, user.role, user.sub);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async update(@Param('id') id: string, @Body() dto: UpdateMethodDto) {
    return this.methodsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async deactivate(@Param('id') id: string) {
    return this.methodsService.deactivate(id);
  }

  // UserMethods management endpoints
  @Post(':userId/methods')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async assignMethod(
    @Param('userId') userId: string,
    @Body() body: { methodId: string },
  ) {
    return this.methodsService.assignMethod(userId, body.methodId);
  }

  @Delete(':userId/methods/:methodId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  async unassignMethod(
    @Param('userId') userId: string,
    @Param('methodId') methodId: string,
  ) {
    return this.methodsService.unassignMethod(userId, methodId);
  }

  @Patch('me/methods/:methodId/schema')
  @UseGuards(JwtAuthGuard)
  @UsePipes(new ValidationPipe({ whitelist: true, transform: true }))
  async updateOutputSchema(
    @Param('methodId') methodId: string,
    @Body() body: { outputSchema: any },
    @CurrentUser() user: any,
  ) {
    return this.methodsService.updateOutputSchema(
      user.sub,
      methodId,
      body.outputSchema,
    );
  }

  @Get('me/methods')
  @UseGuards(JwtAuthGuard)
  async getMyMethods(@CurrentUser() user: any) {
    return this.methodsService.getMyMethods(user.sub);
  }
}

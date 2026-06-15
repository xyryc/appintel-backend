import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Controller('apps')
export class AppsController {
  constructor(private prisma: PrismaService) {}

  @Get()
  findAll() {
    return this.prisma.app.findMany();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.prisma.app.findUnique({ where: { id: Number(id) } });
  }

  @Post()
  create(@Body() body: { name: string; apiKey: string }) {
    return this.prisma.app.create({
      data: { name: body.name, apiKey: body.apiKey },
    });
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.prisma.app.delete({ where: { id: Number(id) } });
  }
}

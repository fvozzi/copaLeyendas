import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { buildDataSourceOptions } from './database/typeorm.config';
import { PostsModule } from './posts/posts.module';
import { LocalitiesModule } from './localities/localities.module';
import { PlayersModule } from './players/players.module';
import { CategoriesModule } from './categories/categories.module';
import { CourtsModule } from './courts/courts.module';
import { TournamentsModule } from './tournaments/tournaments.module';
import { RegistrationsModule } from './registrations/registrations.module';
import { CashModule } from './cash/cash.module';
import { WhatsAppModule } from './whatsapp/whatsapp.module';
import { BackupsModule } from './backups/backups.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => buildDataSourceOptions(configService),
    }),
    AuthModule,
    PostsModule,
    LocalitiesModule,
    PlayersModule,
    CategoriesModule,
    CourtsModule,
    TournamentsModule,
    RegistrationsModule,
    DashboardModule,
    CashModule,
    WhatsAppModule,
    BackupsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}

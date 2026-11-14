import * as C from './config.js';
import type { Files } from './types.js';

/** Fixed project scaffold. The agent only writes src/main/** files, so builds stay reproducible. */
export function scaffold(pluginId: string, name: string): Files {
  const pkg = `com.engine.${pluginId.replace(/[^a-z0-9]/g, '')}`;
  const pkgPath = pkg.replace(/\./g, '/');
  const safeName = name.replace(/\s+/g, ''); // Remove spaces from plugin name for plugin.yml
  return {
    'pom.xml': `<?xml version="1.0" encoding="UTF-8"?>
<project xmlns="http://maven.apache.org/POM/4.0.0"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://maven.apache.org/POM/4.0.0 http://maven.apache.org/xsd/maven-4.0.0.xsd">
    <modelVersion>4.0.0</modelVersion>
    <groupId>com.engine</groupId>
    <artifactId>${pluginId}</artifactId>
    <version>1.0.0</version>
    <packaging>jar</packaging>

    <properties>
        <java.version>${C.JAVA_VERSION}</java.version>
        <project.build.sourceEncoding>UTF-8</project.build.sourceEncoding>
    </properties>

    <repositories>
        <repository>
            <id>papermc</id>
            <url>https://repo.papermc.io/repository/maven-public/</url>
        </repository>
    </repositories>

    <dependencies>
        <dependency>
            <groupId>io.papermc.paper</groupId>
            <artifactId>paper-api</artifactId>
            <version>${C.PAPER_API_VERSION}</version>
            <scope>provided</scope>
        </dependency>
    </dependencies>

    <build>
        <finalName>${pluginId}</finalName>
        <resources>
            <resource>
                <directory>src/main/resources</directory>
                <filtering>true</filtering>
            </resource>
        </resources>
        <plugins>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-compiler-plugin</artifactId>
                <version>${C.MAVEN_COMPILER_VERSION}</version>
                <configuration>
                    <source>${C.JAVA_VERSION}</source>
                    <target>${C.JAVA_VERSION}</target>
                </configuration>
            </plugin>
            <plugin>
                <groupId>org.apache.maven.plugins</groupId>
                <artifactId>maven-shade-plugin</artifactId>
                <version>${C.MAVEN_SHADE_VERSION}</version>
                <executions>
                    <execution>
                        <phase>package</phase>
                        <goals>
                            <goal>shade</goal>
                        </goals>
                    </execution>
                </executions>
            </plugin>
        </plugins>
    </build>
</project>
`,
    'src/main/resources/plugin.yml': `name: ${safeName}
version: 1.0.0
main: ${pkg}.Plugin
api-version: '1.21'
description: ${name}
`,
    'src/main/resources/pack.mcmeta': JSON.stringify(
      {
        pack: { pack_format: 34, description: `${name} resource pack` },
      },
      null,
      2
    ),
    [`src/main/java/${pkgPath}/Plugin.java`]: `package ${pkg};

import org.bukkit.plugin.java.JavaPlugin;

public class Plugin extends JavaPlugin {
    @Override
    public void onEnable() {
        getLogger().info("${name} enabled!");
    }

    @Override
    public void onDisable() {
        getLogger().info("${name} disabled!");
    }
}
`,
  };
}
export const packageFor = (pluginId: string) => `com.engine.${pluginId.replace(/[^a-z0-9]/g, '')}`;

/** Paths the agent may write. Everything else is scaffold-owned. */
export function isWritable(p: string): boolean {
  if (p.includes('..') || p.startsWith('/') || p.includes('\\')) return false;
  // Protect scaffold files
  if (p === 'pom.xml') return false;
  if (p === 'src/main/resources/plugin.yml') return false;
  if (p === 'src/main/resources/pack.mcmeta') return false;
  return /^src\/main\/(java|resources)\/[\w\-./]+$/.test(p);
}
